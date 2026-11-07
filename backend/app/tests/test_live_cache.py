"""Krátká cache výsledků live přenosu (PERF-01).

Každý divák na /zive se ptá každých 5 s a sestavení výsledků je drahé (dva dotazy a průchod
celou startovkou). Bez cache server zvládl jen 400–600 diváků (harness/load/results/2026-11-07.md).
"""

import threading

import pytest

from app.models import Race
from app.services.live_cache import LiveCache


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def test_payload_is_reused_within_the_ttl():
    clock = FakeClock()
    cache = LiveCache(ttl_seconds=2.0, clock=clock)
    calls = []

    first = cache.get(lambda: calls.append(1) or {"n": len(calls)})
    clock.now += 1.9
    second = cache.get(lambda: calls.append(1) or {"n": len(calls)})

    assert first == second == {"n": 1}
    assert len(calls) == 1


def test_payload_is_recomputed_after_the_ttl():
    clock = FakeClock()
    cache = LiveCache(ttl_seconds=2.0, clock=clock)
    calls = []

    cache.get(lambda: calls.append(1) or {"n": len(calls)})
    clock.now += 2.1
    refreshed = cache.get(lambda: calls.append(1) or {"n": len(calls)})

    assert refreshed == {"n": 2}


def test_no_live_race_is_cached_as_none():
    clock = FakeClock()
    cache = LiveCache(ttl_seconds=2.0, clock=clock)
    calls = []

    cache.get(lambda: calls.append(1))
    result = cache.get(lambda: calls.append(1))

    assert result is None
    assert len(calls) == 1


def test_only_one_caller_recomputes_and_the_others_get_the_previous_payload():
    clock = FakeClock()
    cache = LiveCache(ttl_seconds=2.0, clock=clock)
    cache.get(lambda: {"version": 1})
    clock.now += 3
    started, release = threading.Event(), threading.Event()

    def slow_compute():
        started.set()
        release.wait(5)
        return {"version": 2}

    refresher = threading.Thread(target=lambda: cache.get(slow_compute))
    refresher.start()
    started.wait(5)

    during = cache.get(lambda: pytest.fail("a second caller must not recompute"))
    release.set()
    refresher.join(5)

    assert during == {"version": 1}
    assert cache.get(lambda: {"version": 3}) == {"version": 2}


def test_a_value_older_than_max_stale_is_never_served_to_a_concurrent_caller():
    clock = FakeClock()
    cache = LiveCache(ttl_seconds=2.0, max_stale_seconds=4.0, clock=clock)
    cache.get(lambda: {"race": "last week"})
    clock.now += 7 * 24 * 3600  # worker idle since the previous race
    started, release = threading.Event(), threading.Event()
    results = []

    def slow_compute():
        started.set()
        release.wait(5)
        return {"race": "today"}

    refresher = threading.Thread(target=lambda: results.append(cache.get(slow_compute)))
    refresher.start()
    started.wait(5)
    waiter = threading.Thread(target=lambda: results.append(cache.get(lambda: {"race": "other"})))
    waiter.start()
    release.set()
    refresher.join(5)
    waiter.join(5)

    assert results == [{"race": "today"}, {"race": "today"}]


def test_first_callers_without_a_value_compute_once_and_share_the_result():
    cache = LiveCache(ttl_seconds=2.0, clock=FakeClock())
    started, release = threading.Event(), threading.Event()
    calls, results = [], []

    def slow_compute():
        calls.append(1)
        started.set()
        release.wait(5)
        return {"version": 1}

    first = threading.Thread(target=lambda: results.append(cache.get(slow_compute)))
    first.start()
    started.wait(5)
    second = threading.Thread(target=lambda: results.append(cache.get(slow_compute)))
    second.start()
    release.set()
    first.join(5)
    second.join(5)

    assert len(calls) == 1
    assert results == [{"version": 1}, {"version": 1}]


def test_lock_is_released_after_a_failed_refresh_of_a_stale_value():
    clock = FakeClock()
    cache = LiveCache(ttl_seconds=2.0, clock=clock)
    cache.get(lambda: {"version": 1})
    clock.now += 3

    with pytest.raises(RuntimeError):
        cache.get(lambda: (_ for _ in ()).throw(RuntimeError("db down")))

    assert cache.get(lambda: {"version": 2}) == {"version": 2}


def test_failed_computation_is_not_cached():
    cache = LiveCache(ttl_seconds=2.0, clock=FakeClock())

    with pytest.raises(RuntimeError):
        cache.get(lambda: (_ for _ in ()).throw(RuntimeError("db down")))

    assert cache.get(lambda: {"ok": True}) == {"ok": True}


@pytest.fixture
def frozen_live_cache(monkeypatch):
    """Cache endpointu s falešnými hodinami: test nezávisí na rychlosti stroje."""
    from app.routers import races

    cache = LiveCache(ttl_seconds=2.0, clock=FakeClock())
    monkeypatch.setattr(races, "live_results", cache)
    return cache


def test_endpoint_serves_the_same_payload_within_the_ttl(client, db, frozen_live_cache):
    db.add(Race(race_nr="JMLP2026-09", is_live=True, registration=False, closed=False,
                race_method_id=1, season_id=2026))
    db.commit()

    first = client.get("/races/live")
    second = client.get("/races/live")

    assert first.status_code == second.status_code == 200
    assert first.content == second.content
    assert first.json()["updated_at"] == second.json()["updated_at"]
    assert second.headers["cache-control"] == "no-store"
    assert second.headers["content-type"].startswith("application/json")


def test_endpoint_keeps_czech_characters_in_the_cached_json(client, db, frozen_live_cache):
    from app.models import Areal

    areal = Areal(name="Přelouč – Žďár")
    db.add(areal)
    db.commit()
    db.add(Race(race_nr="JMLP2026-10", is_live=True, registration=False, closed=False,
                race_method_id=1, season_id=2026, areal_id=areal.id))
    db.commit()

    assert client.get("/races/live").json()["areal_name"] == "Přelouč – Žďár"
