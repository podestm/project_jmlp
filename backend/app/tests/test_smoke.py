"""Ověřuje, že pytest v kontejneru běží a vidí aplikační balíček."""


def test_pytest_runs():
    assert True


def test_app_package_importable():
    from app import models
    assert hasattr(models, "File")
