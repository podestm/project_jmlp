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
