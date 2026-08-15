from app.services.naming import slugify, role_suffix, ROLE_SUFFIX


def test_slugify_removes_diacritics():
    assert slugify("FreeSki Academy Brno") == "freeski-academy-brno"
    assert slugify("Ski klub Velké Meziříčí") == "ski-klub-velke-mezirici"


def test_slugify_collapses_separators():
    assert slugify("a  b__c--d") == "a-b-c-d"
    assert slugify("  ...  ") == ""


def test_role_suffix_is_ascii_and_known():
    assert role_suffix("propozice") == "propozice"
    assert role_suffix("vysledky") == "vysledky"
    assert role_suffix("image") == "obrazek"
    assert role_suffix("document") == "dokument"
    assert role_suffix("logo") == "logo"
    assert role_suffix("neco-jineho") == "soubor"


def test_every_known_role_has_suffix():
    from app.models import AttachmentRole
    for role in AttachmentRole:
        assert role in ROLE_SUFFIX


from app.services.naming import owner_stem


class FakeRace:
    def __init__(self, race_nr):
        self.race_nr = race_nr


class FakeClub:
    def __init__(self, name):
        self.name = name


def test_owner_stem_race_keeps_race_number_case():
    assert owner_stem("race", 127, FakeRace("JMLP2025-05")) == "JMLP2025-05"


def test_owner_stem_race_without_number_falls_back_to_id():
    assert owner_stem("race", 127, FakeRace(None)) == "zavod-127"


def test_owner_stem_season_spans_two_years():
    assert owner_stem("season", 2025, None) == "sezona-2025-2026"


def test_owner_stem_club_is_slugified():
    assert owner_stem("club", 5, FakeClub("FreeSki Academy Brno")) == "klub-freeski-academy-brno"


def test_owner_stem_club_without_usable_name_falls_back_to_id():
    # Klub bez řádku nebo bez názvu by jinak dal holé "klub-" pro všechny kluby.
    assert owner_stem("club", 5, None) == "klub-5"
    assert owner_stem("club", 5, FakeClub("")) == "klub-5"
    assert owner_stem("club", 5, FakeClub("???")) == "klub-5"


def test_owner_stem_post_uses_id():
    assert owner_stem("post", 6, None) == "clanek-6"


def test_owner_stem_library_has_no_systematic_name():
    assert owner_stem("library", None, None) is None


from app.services.naming import unique_name


def test_unique_name_returns_stem_when_free():
    assert unique_name("JMLP2025-05_propozice", ".pdf", taken=set()) == "JMLP2025-05_propozice.pdf"


def test_unique_name_appends_counter_on_collision():
    taken = {"JMLP2025-05_propozice.pdf"}
    assert unique_name("JMLP2025-05_propozice", ".pdf", taken) == "JMLP2025-05_propozice-2.pdf"


def test_unique_name_skips_multiple_collisions():
    taken = {
        "sezona-2025-2026_dokument.pdf",
        "sezona-2025-2026_dokument-2.pdf",
        "sezona-2025-2026_dokument-3.pdf",
    }
    assert unique_name("sezona-2025-2026_dokument", ".pdf", taken) == "sezona-2025-2026_dokument-4.pdf"


def test_unique_name_is_case_insensitive():
    taken = {"jmlp2025-05_propozice.pdf"}
    assert unique_name("JMLP2025-05_propozice", ".pdf", taken) == "JMLP2025-05_propozice-2.pdf"


import pytest
from app.services.naming import sanitize_manual_name


def test_sanitize_keeps_diacritics():
    assert sanitize_manual_name("Soutěžní řád XIX. ročník", ".pdf") == "Soutěžní řád XIX. ročník.pdf"


def test_sanitize_keeps_numbered_czech_names():
    # "1. kolo" konci na " kolo" - pet znaku za teckou, ale pripona to neni.
    assert sanitize_manual_name("Výsledky 1. kolo", ".pdf") == "Výsledky 1. kolo.pdf"


def test_sanitize_forces_real_extension():
    assert sanitize_manual_name("propozice.jpg", ".pdf") == "propozice.pdf"
    assert sanitize_manual_name("propozice", ".pdf") == "propozice.pdf"


def test_sanitize_strips_path_separators():
    assert sanitize_manual_name("../../etc/passwd", ".pdf") == "etc-passwd.pdf"
    assert sanitize_manual_name("a/b\\c", ".pdf") == "a-b-c.pdf"


def test_sanitize_strips_control_characters():
    assert sanitize_manual_name("na\x00zev\ntest", ".pdf") == "nazevtest.pdf"


def test_sanitize_rejects_empty():
    with pytest.raises(ValueError):
        sanitize_manual_name("   ", ".pdf")
    with pytest.raises(ValueError):
        sanitize_manual_name("///", ".pdf")
