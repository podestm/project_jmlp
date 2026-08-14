from datetime import date

from app.services.library import LibraryFilters, build_where


def test_no_filters_matches_everything():
    where, params = build_where(LibraryFilters())
    assert where == ""
    assert params == {}


def test_name_filter_uses_like():
    where, params = build_where(LibraryFilters(q="propozice"))
    assert "f.original_filename LIKE :q" in where
    assert params["q"] == "%propozice%"


def test_extension_filter_is_normalised():
    where, params = build_where(LibraryFilters(extension=".PDF"))
    assert params["extension"] == "pdf"


def test_date_range_is_inclusive_on_both_ends():
    where, params = build_where(
        LibraryFilters(date_from=date(2026, 1, 1), date_to=date(2026, 1, 31))
    )
    assert "f.uploaded_at >= :date_from" in where
    assert "f.uploaded_at < :date_to_exclusive" in where
    assert params["date_to_exclusive"] == date(2026, 2, 1)


def test_owner_type_filter_uses_attachment_subquery():
    where, params = build_where(LibraryFilters(owner_type="race"))
    assert "fuj_jmlp_attachment" in where
    assert params["owner_type"] == "race"
