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
