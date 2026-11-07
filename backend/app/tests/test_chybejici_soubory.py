"""Záznam, jehož soubor na disku chybí.

Nastane po ručním smazání souboru z volume, po nepovedeném přenosu nebo po
chybě obsluhy. Aplikace se pak musí chovat rozdílně podle toho, kdo se dívá:

  * návštěvník nesmí dostat odkaz na obrázek, který neexistuje - jinak mu
    v příspěvku zůstane prázdné místo po rozbitém obrázku,
  * záznam bez souboru se pročišťuje jednorázově (vazby i řádek souboru pryč),
    ne označováním v UI.
"""

from pathlib import Path

import pytest

from app import models
from app.models import AttachmentOwner, AttachmentRole
from app.services import attachments as attachment_service

DOCUMENTS_DIR = Path("uploads/documents")
_ZALOZENE = []


@pytest.fixture(autouse=True)
def _uklid():
    yield
    while _ZALOZENE:
        _ZALOZENE.pop().unlink(missing_ok=True)


def _soubor(db, original="obrazek.jpg", na_disku=True):
    import uuid

    filename = f"{uuid.uuid4().hex}{Path(original).suffix}"
    cesta = DOCUMENTS_DIR / filename
    if na_disku:
        DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
        cesta.write_bytes(b"\x89PNG obsah")
        _ZALOZENE.append(cesta)

    record = models.File(
        filename=filename,
        original_filename=original,
        file_path=str(cesta),
        file_size=10,
        mime_type="image/jpeg",
        file_type=models.FileTypeEnum.image,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def _prispevek(db, title="Závody v Olešnici se blíží.."):
    post = models.Post(title=title, content="Obsah", published=True)
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


def _pripoj(db, post, soubor, role=AttachmentRole.image.value):
    attachment_service.attach(
        db,
        file_id=soubor.id,
        owner_type=AttachmentOwner.post.value,
        owner_id=post.id,
        role=role,
    )


def test_prispevek_s_existujicim_obrazkem_ho_nabidne(client, db):
    post = _prispevek(db)
    _pripoj(db, post, _soubor(db))

    telo = client.get("/posts/").json()
    muj = next(p for p in telo if p["id"] == post.id)

    assert muj["image_file_id"] is not None
    assert client.get(f"/posts/{post.id}/image").status_code == 200


def test_prispevek_s_chybejicim_obrazkem_ho_nenabizi(client, db):
    """Jinak prohlížeč požádá o obrázek, dostane 404 a zůstane prázdné místo."""
    post = _prispevek(db)
    _pripoj(db, post, _soubor(db, na_disku=False))

    telo = client.get("/posts/").json()
    muj = next(p for p in telo if p["id"] == post.id)

    assert muj["image_file_id"] is None


def test_chybejici_dokument_prispevku_se_taky_zamlci(client, db):
    post = _prispevek(db)
    _pripoj(
        db,
        post,
        _soubor(db, original="propozice.pdf", na_disku=False),
        role=AttachmentRole.document.value,
    )

    muj = next(p for p in client.get("/posts/").json() if p["id"] == post.id)

    assert muj["document_file_id"] is None


def test_chybejici_obrazek_neskryje_existujici_dokument(client, db):
    post = _prispevek(db)
    _pripoj(db, post, _soubor(db, na_disku=False))
    _pripoj(db, post, _soubor(db, original="propozice.pdf"), role=AttachmentRole.document.value)

    muj = next(p for p in client.get("/posts/").json() if p["id"] == post.id)

    assert muj["image_file_id"] is None
    assert muj["document_file_id"] is not None
