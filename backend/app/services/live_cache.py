"""Krátká cache výsledků live přenosu.

Divák na /zive se ptá každých 5 s; bez cache každý dotaz znovu čte startovku a sestavuje celé
výsledky, a server tak zvládl jen 400–600 diváků (harness/load/results/2026-11-07.md, PERF-01).
S cache se výsledky sestaví nejvýš jednou za `ttl_seconds` v každém workeru.

Když platnost vyprší, přepočítá jen jeden požadavek; ostatní mezitím dostanou předchozí verzi
(žádná lavina přepočtů) — ale jen do stáří `max_stale_seconds`. Starší hodnotu (worker dlouho
nečinný, třeba od minulého závodu) nikdo nedostane: počká na přepočet stejně jako úplně první
požadavek. Chyba výpočtu se necachuje.
"""

import threading
import time
from collections.abc import Callable
from typing import Any

_MISSING = object()


class LiveCache:
    def __init__(
        self,
        ttl_seconds: float,
        max_stale_seconds: float | None = None,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._ttl = ttl_seconds
        self._max_stale = max_stale_seconds if max_stale_seconds is not None else 2 * ttl_seconds
        self._clock = clock
        self._lock = threading.Lock()
        # Hodnota a čas výpočtu v jedné dvojici: čtenář bez zámku vždy vidí konzistentní pár.
        self._entry: tuple[Any, float] = (_MISSING, 0.0)

    def get(self, compute: Callable[[], Any]) -> Any:
        """Vrátí platnou hodnotu, nebo ji spočítá; `None` (žádný živý závod) se cachuje taky."""
        value, computed_at = self._entry
        age = self._clock() - computed_at
        if value is not _MISSING and age < self._ttl:
            return value

        usable_stale = value is not _MISSING and age < self._max_stale
        if usable_stale:
            # Přepočítá jen ten, kdo získá zámek; ostatní vrátí předchozí, ještě dost čerstvou verzi.
            if not self._lock.acquire(blocking=False):
                return value
        else:
            self._lock.acquire()

        try:
            value, computed_at = self._entry
            if value is not _MISSING and self._clock() - computed_at < self._ttl:
                return value  # mezitím přepočítal někdo jiný
            value = compute()
            self._entry = (value, self._clock())
            return value
        finally:
            self._lock.release()

    def clear(self) -> None:
        with self._lock:
            self._entry = (_MISSING, 0.0)


# Jedna instance na proces (worker uvicornu): sestavené výsledky jako hotový JSON.
live_results = LiveCache(ttl_seconds=2.0)
