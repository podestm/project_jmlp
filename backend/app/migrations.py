"""Databázové migrace spouštěné při startu aplikace.

V projektu není Alembic - schéma je legacy import a migrace se dělají jako
idempotentní DDL příkazy chráněné dotazem do INFORMATION_SCHEMA. Každá migrace
je funkce `_m_*(conn)`, která si sama zkontroluje, jestli už proběhla.

Pravidla (viz CLAUDE.md):
- MyISAM, žádné FOREIGN KEY constraints
- nové textové sloupce explicitně utf8mb4 (a čtou se BEZ fix_encoding)
"""
import logging
from pathlib import Path

from sqlalchemy import text

logger = logging.getLogger(__name__)


def _column_exists(conn, table: str, column: str) -> bool:
    return conn.execute(text(
        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
        "WHERE TABLE_SCHEMA = DATABASE() "
        "AND TABLE_NAME = :t AND COLUMN_NAME = :c"
    ), {"t": table, "c": column}).scalar() > 0


def _index_exists(conn, table: str, index: str) -> bool:
    return conn.execute(text(
        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS "
        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND INDEX_NAME = :i"
    ), {"t": table, "i": index}).scalar() > 0


def _table_exists(conn, table: str) -> bool:
    return conn.execute(text(
        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES "
        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t"
    ), {"t": table}).scalar() > 0


# --------------------------------------------------------------------------
# 000 - dorovnání schématu z původní databáze
#
# Ostrá databáze jmlp.cz vznikla ještě před sjednocením názvů a část změn se
# tady kdysi udělala ručně, takže po nich v repu nezůstala stopa. Bez tohohle
# kroku by na ní nový kód spadl hned při startu - modely míří na tabulky
# a sloupce, které tam nejsou.
#
# Běží jako první: ostatní migrace už s novými názvy počítají (například
# _m_attachments čte fuj_jmlp_posts.image_file_id).
#
# Data se nikde nezahazují. Sloupce raceCategory_id a raceType_id nový model
# nezná, ale nesou klasifikaci 109 závodů - proto se jen uvolní na NULL, aby
# nebránily zápisu nového závodu. Zahodit je lze později vědomě.
# --------------------------------------------------------------------------
_STARTOVKA_SLOUPCE = (
    ("racer_name", "varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL"),
    ("racer_surname", "varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL"),
    ("racer_year", "int DEFAULT NULL"),
    ("racer_sex", "smallint DEFAULT NULL"),
    ("club_name", "varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL"),
    ("category_name", "varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL"),
    ("category_sex", "smallint DEFAULT NULL"),
    ("race_number_display", "varchar(8) DEFAULT NULL"),
    ("name_override", "varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL"),
    ("surname_override", "varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL"),
    ("year_override", "int DEFAULT NULL"),
)


def _m_legacy_schema(conn):
    # 1) tabulky bez prefixu
    for stary, novy in (("posts", "fuj_jmlp_posts"),
                        ("race_registration", "fuj_jmlp_race_registration")):
        if _table_exists(conn, stary) and not _table_exists(conn, novy):
            conn.execute(text(f"RENAME TABLE {stary} TO {novy}"))
            logger.info("Migrace: %s -> %s", stary, novy)

    # 2) camelCase sloupce závodu
    for stary, novy, definice in (
        ("raceNr", "race_nr", "varchar(255) DEFAULT NULL"),
        ("raceMethod_id", "race_method_id", "bigint NOT NULL"),
    ):
        if _column_exists(conn, "fuj_jmlp_race", stary) and not _column_exists(conn, "fuj_jmlp_race", novy):
            conn.execute(text(f"ALTER TABLE fuj_jmlp_race CHANGE `{stary}` `{novy}` {definice}"))
            logger.info("Migrace: fuj_jmlp_race.%s -> %s", stary, novy)

    # 3) chybějící sloupce, které nedoplňuje žádná pozdější migrace
    chybejici = [
        ("fuj_jmlp_race", "is_live", "tinyint(1) NOT NULL DEFAULT '0'"),
        ("fuj_jmlp_race", "timekeeper_category_order", "varchar(1000) DEFAULT NULL"),
        ("fuj_jmlp_race_numbers", "set_color",
         "varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'rose'"),
        ("fuj_jmlp_race_numbers", "is_active", "tinyint(1) NOT NULL DEFAULT '1'"),
    ]
    chybejici += [("fuj_jmlp_race_start_list", jmeno, definice)
                  for jmeno, definice in _STARTOVKA_SLOUPCE]

    for tabulka, sloupec, definice in chybejici:
        if _table_exists(conn, tabulka) and not _column_exists(conn, tabulka, sloupec):
            conn.execute(text(f"ALTER TABLE {tabulka} ADD COLUMN `{sloupec}` {definice}"))
            logger.info("Migrace: %s.%s doplněn", tabulka, sloupec)

    # 4) legacy klasifikace závodu: data zůstávají, jen přestanou být povinná
    for sloupec in ("raceCategory_id", "raceType_id"):
        if _column_exists(conn, "fuj_jmlp_race", sloupec):
            conn.execute(text(f"ALTER TABLE fuj_jmlp_race MODIFY `{sloupec}` bigint NULL"))
            logger.info("Migrace: fuj_jmlp_race.%s uvolněn na NULL (data zůstávají)", sloupec)

    # 5) posts.image_path nový model nezná. Zahodí se jen když je prázdný -
    #    jinak by to byla ztráta a raději ať upgrade skončí s plným sloupcem.
    if _column_exists(conn, "fuj_jmlp_posts", "image_path"):
        pouzity = conn.execute(text(
            "SELECT COUNT(*) FROM fuj_jmlp_posts WHERE image_path IS NOT NULL AND image_path <> ''"
        )).scalar()
        if pouzity:
            logger.warning(
                "Migrace: fuj_jmlp_posts.image_path nese %s hodnot, nechávám ho být", pouzity
            )
        else:
            conn.execute(text("ALTER TABLE fuj_jmlp_posts DROP COLUMN image_path"))
            logger.info("Migrace: fuj_jmlp_posts.image_path zahozen (byl prázdný)")


# --------------------------------------------------------------------------
# 001 - poznámka k žádosti o klub u registrace
# --------------------------------------------------------------------------
def _m_registration_club_request_note(conn):
    if _column_exists(conn, "fuj_jmlp_race_registration", "club_request_note"):
        return
    conn.execute(text(
        "ALTER TABLE fuj_jmlp_race_registration "
        "ADD COLUMN club_request_note VARCHAR(500) NULL DEFAULT NULL"
    ))
    logger.info("Migrace: fuj_jmlp_race_registration.club_request_note")


# --------------------------------------------------------------------------
# 002 - univerzální tabulka příloh
#
# Nahrazuje pět samostatně řešených vazeb "soubor patří k něčemu":
#   race.proposition_file_id, race.results_file_id,
#   posts.image_file_id, posts.document_file_id,
#   fuj_jmlp_season_results.document_id
# Původní sloupce zůstávají fyzicky na místě jako pojistka pro rollback,
# jen se přestanou číst. Jejich DROP je samostatný, pozdější krok.
# --------------------------------------------------------------------------
def _m_attachments(conn):
    if _table_exists(conn, "fuj_jmlp_attachment"):
        return

    conn.execute(text("""
        CREATE TABLE fuj_jmlp_attachment (
          id          BIGINT       NOT NULL AUTO_INCREMENT,
          file_id     BIGINT       NOT NULL,
          owner_type  VARCHAR(16)  NOT NULL,
          owner_id    BIGINT       NULL,
          role        VARCHAR(24)  NOT NULL,
          title       VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
          sort_order  INT          NOT NULL DEFAULT 0,
          published   TINYINT(1)   NOT NULL DEFAULT 1,
          is_generated TINYINT(1)  NOT NULL DEFAULT 0,
          created_at  DATETIME     NULL DEFAULT CURRENT_TIMESTAMP,
          created_by  BIGINT       NULL,
          PRIMARY KEY (id),
          KEY idx_attachment_owner (owner_type, owner_id),
          KEY idx_attachment_file (file_id),
          KEY idx_attachment_role (role)
        ) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """))

    # Backfill závodů - propozice a výsledky
    for column, role in (("proposition_file_id", "propozice"), ("results_file_id", "vysledky")):
        conn.execute(text(f"""
            INSERT INTO fuj_jmlp_attachment (file_id, owner_type, owner_id, role, sort_order, published)
            SELECT r.{column}, 'race', r.id, :role, 0, 1
            FROM fuj_jmlp_race r
            JOIN fuj_jmlp_files f ON f.id = r.{column}
            WHERE r.{column} IS NOT NULL
        """), {"role": role})

    # Backfill článků - obrázek a dokument
    for column, role in (("image_file_id", "image"), ("document_file_id", "document")):
        conn.execute(text(f"""
            INSERT INTO fuj_jmlp_attachment (file_id, owner_type, owner_id, role, sort_order, published)
            SELECT p.{column}, 'post', p.id, :role, 0, 1
            FROM fuj_jmlp_posts p
            JOIN fuj_jmlp_files f ON f.id = p.{column}
            WHERE p.{column} IS NOT NULL
        """), {"role": role})

    # Backfill sezónních výsledků - owner_id je rok začátku sezóny
    if _table_exists(conn, "fuj_jmlp_season_results"):
        conn.execute(text("""
            INSERT INTO fuj_jmlp_attachment (file_id, owner_type, owner_id, role, sort_order, published)
            SELECT sr.document_id, 'season', sr.season_year_start,
                   CASE WHEN sr.final_results = 1 THEN 'vysledky' ELSE 'prubezne' END,
                   0, 1
            FROM fuj_jmlp_season_results sr
            JOIN fuj_jmlp_files f ON f.id = sr.document_id
        """))

    # Zbylé soubory bez vazby zůstávají v knihovně - nic se neztratí
    conn.execute(text("""
        INSERT INTO fuj_jmlp_attachment (file_id, owner_type, owner_id, role, sort_order, published)
        SELECT f.id, 'library', NULL,
               CASE WHEN f.file_type = 'image' THEN 'image' ELSE 'document' END,
               0, 1
        FROM fuj_jmlp_files f
        LEFT JOIN fuj_jmlp_attachment a ON a.file_id = f.id
        WHERE a.id IS NULL
    """))

    total = conn.execute(text("SELECT COUNT(*) FROM fuj_jmlp_attachment")).scalar()
    logger.info("Migrace: fuj_jmlp_attachment vytvořena, backfill %s příloh", total)


# --------------------------------------------------------------------------
# 003 - sezóny (ročník poháru, název, dokumenty sezóny)
# --------------------------------------------------------------------------
# Sezóna 2025 = XIX. ročník  ->  edition = year_start - 2006
EDITION_BASE_YEAR = 2006


def _m_seasons(conn):
    if _table_exists(conn, "fuj_jmlp_season"):
        return

    conn.execute(text("""
        CREATE TABLE fuj_jmlp_season (
          id         BIGINT       NOT NULL AUTO_INCREMENT,
          year_start INT          NOT NULL,
          year_end   INT          NOT NULL,
          edition    INT          NULL,
          name       VARCHAR(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
          active     TINYINT(1)   NOT NULL DEFAULT 1,
          created_at DATETIME     NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME     NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_season_year (year_start)
        ) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """))

    # Backfill ze závodů i ze starých sezónních výsledků
    conn.execute(text("""
        INSERT INTO fuj_jmlp_season (year_start, year_end, edition, name, active)
        SELECT y.year_start, y.year_start + 1, y.year_start - :base,
               'Jihomoravský lyžařský pohár', 1
        FROM (
            SELECT DISTINCT season_id AS year_start FROM fuj_jmlp_race WHERE season_id IS NOT NULL
        ) y
    """), {"base": EDITION_BASE_YEAR})

    if _table_exists(conn, "fuj_jmlp_season_results"):
        conn.execute(text("""
            INSERT IGNORE INTO fuj_jmlp_season (year_start, year_end, edition, name, active)
            SELECT sr.season_year_start, sr.season_year_end,
                   sr.season_year_start - :base, 'Jihomoravský lyžařský pohár', 1
            FROM fuj_jmlp_season_results sr
        """), {"base": EDITION_BASE_YEAR})

    total = conn.execute(text("SELECT COUNT(*) FROM fuj_jmlp_season")).scalar()
    logger.info("Migrace: fuj_jmlp_season vytvořena, backfill %s sezón", total)


# --------------------------------------------------------------------------
# 004 - zobrazovaný název kategorie
#
# Dosud se název skládal za běhu na "U8 Myšáci - Ženy", zatímco výsledkové
# listiny používají "Myšáci dívky". display_name je jediný zobrazovaný název -
# stejný na webu, v timekeeperu i v PDF. Je editovatelný v administraci.
# --------------------------------------------------------------------------
CATEGORY_DISPLAY_NAMES = {
    # (název, sex): zobrazovaný název     sex: 1 = muži/chlapci, 2 = ženy/dívky
    ("U8 Myšáci", 1): "Myšáci chlapci",
    ("U8 Myšáci", 2): "Myšáci dívky",
    ("U10 Přípravka", 1): "Přípravka chlapci",
    ("U10 Přípravka", 2): "Přípravka dívky",
    ("U12 Předžactvo", 1): "Předžáci",
    ("U12 Předžactvo", 2): "Předžačky",
    ("U14 Mladší žactvo", 1): "Mladší žáci",
    ("U14 Mladší žactvo", 2): "Mladší žačky",
    ("U16 Starší žactvo", 1): "Starší žáci",
    ("U16 Starší žactvo", 2): "Starší žačky",
    ("U21 Junioři", 1): "Junioři",
    ("U21 Junioři", 2): "Juniorky",
    ("OPEN", 1): "OPEN muži",
    ("OPEN", 2): "OPEN ženy",
}


def _m_category_display_name(conn):
    if _column_exists(conn, "fuj_jmlp_category", "display_name"):
        return

    conn.execute(text(
        "ALTER TABLE fuj_jmlp_category "
        "ADD COLUMN display_name VARCHAR(120) CHARACTER SET utf8mb4 "
        "COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL"
    ))

    # Překlep v datech: "Mladší žastvo" -> "Mladší žactvo"
    conn.execute(text(
        "UPDATE fuj_jmlp_category SET name = REPLACE(name, 'žastvo', 'žactvo') "
        "WHERE name LIKE '%žastvo%'"
    ))

    for (name, sex), display_name in CATEGORY_DISPLAY_NAMES.items():
        conn.execute(text(
            "UPDATE fuj_jmlp_category SET display_name = :display_name "
            "WHERE name = :name AND sex = :sex"
        ), {"display_name": display_name, "name": name, "sex": sex})

    filled = conn.execute(text(
        "SELECT COUNT(*) FROM fuj_jmlp_category WHERE display_name IS NOT NULL"
    )).scalar()
    logger.info("Migrace: fuj_jmlp_category.display_name vyplněn u %s kategorií", filled)


# --------------------------------------------------------------------------
# 005 - hlavičkové údaje závodu pro výsledkovou listinu
#
# Činovníci jsou 1:1 se závodem, údaje o kole 1:N (jedno nebo dvě kola),
# proto samostatná tabulka - generátor listiny pak vykreslí 1.KOLO i 2.KOLO
# jedním cyklem místo větvení.
#
# Nové sloupce jsou čisté utf8mb4 a čtou se prostým SELECTem, BEZ fix_encoding
# a convert_utf8_field - ty patří jen na legacy sloupce.
# --------------------------------------------------------------------------
def _m_race_header(conn):
    if _column_exists(conn, "fuj_jmlp_race", "race_director"):
        return

    conn.execute(text("""
        ALTER TABLE fuj_jmlp_race
          ADD COLUMN race_director      VARCHAR(120) CHARACTER SET utf8mb4
                                        COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
          ADD COLUMN technical_delegate VARCHAR(120) CHARACTER SET utf8mb4
                                        COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
          ADD COLUMN chief_timekeeper   VARCHAR(120) CHARACTER SET utf8mb4
                                        COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
          ADD COLUMN run_count          TINYINT NOT NULL DEFAULT 1
    """))

    # Jednorázový backfill z naměřených dat.
    #
    # Sloupec se dnes už nepoužívá a nikde se nenastavuje: ukázalo se, že počet
    # kol není vlastnost závodu - jedna kategorie může jet obě kola a jiná jen
    # jedno. Listina se řídí naměřenými daty každé kategorie zvlášť
    # (frontend/src/pdf/resultsPdf.js). Zůstává jen proto, že je NOT NULL
    # a mazat sloupec v ostré databázi kvůli tomu nemá cenu.
    conn.execute(text("""
        UPDATE fuj_jmlp_race r
        SET r.run_count = 2
        WHERE EXISTS (
            SELECT 1 FROM fuj_jmlp_race_start_list sl
            WHERE sl.race_id = r.id AND sl.time2 IS NOT NULL
        )
    """))

    two_run = conn.execute(text(
        "SELECT COUNT(*) FROM fuj_jmlp_race WHERE run_count = 2"
    )).scalar()
    logger.info("Migrace: hlavičkové sloupce závodu, %s závodů na dvě kola", two_run)


def _m_race_run(conn):
    if _table_exists(conn, "fuj_jmlp_race_run"):
        return

    conn.execute(text("""
        CREATE TABLE fuj_jmlp_race_run (
          id              BIGINT       NOT NULL AUTO_INCREMENT,
          race_id         BIGINT       NOT NULL,
          run_number      TINYINT      NOT NULL,
          course_setter   VARCHAR(120) CHARACTER SET utf8mb4
                                       COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
          gates_count     INT          NULL DEFAULT NULL,
          conditions      VARCHAR(120) CHARACTER SET utf8mb4
                                       COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
          start_time      VARCHAR(10)  NULL DEFAULT NULL,
          course_length_m INT          NULL DEFAULT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY uq_race_run (race_id, run_number)
        ) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """))
    logger.info("Migrace: fuj_jmlp_race_run vytvořena")


# --------------------------------------------------------------------------
# 006 - úklid po přechodu na přílohy
#
# Zahodí sloupce a tabulku, ze kterých se od migrace 002 nečte. Je to jediná
# destruktivní migrace v projektu, proto si sama ověří, že každá původní vazba
# má protějšek ve fuj_jmlp_attachment. Když by se nesouhlasilo cokoli, nic
# nesmaže a jen to zaloguje - raději nechat mrtvý sloupec než přijít o vazbu.
# --------------------------------------------------------------------------

# (popis, dotaz na počet vazeb ve sloupci, dotaz na počet vazeb i v přílohách)
_LEGACY_LINK_CHECKS = (
    (
        "fuj_jmlp_race.proposition_file_id",
        "SELECT COUNT(*) FROM fuj_jmlp_race r "
        "JOIN fuj_jmlp_files f ON f.id = r.proposition_file_id",
        "SELECT COUNT(*) FROM fuj_jmlp_race r "
        "JOIN fuj_jmlp_files f ON f.id = r.proposition_file_id "
        "JOIN fuj_jmlp_attachment a ON a.owner_type = 'race' AND a.owner_id = r.id "
        "AND a.role = 'propozice' AND a.file_id = r.proposition_file_id",
    ),
    (
        "fuj_jmlp_race.results_file_id",
        "SELECT COUNT(*) FROM fuj_jmlp_race r "
        "JOIN fuj_jmlp_files f ON f.id = r.results_file_id",
        "SELECT COUNT(*) FROM fuj_jmlp_race r "
        "JOIN fuj_jmlp_files f ON f.id = r.results_file_id "
        "JOIN fuj_jmlp_attachment a ON a.owner_type = 'race' AND a.owner_id = r.id "
        "AND a.role = 'vysledky' AND a.file_id = r.results_file_id",
    ),
    (
        "fuj_jmlp_posts.image_file_id",
        "SELECT COUNT(*) FROM fuj_jmlp_posts p "
        "JOIN fuj_jmlp_files f ON f.id = p.image_file_id",
        "SELECT COUNT(*) FROM fuj_jmlp_posts p "
        "JOIN fuj_jmlp_files f ON f.id = p.image_file_id "
        "JOIN fuj_jmlp_attachment a ON a.owner_type = 'post' AND a.owner_id = p.id "
        "AND a.role = 'image' AND a.file_id = p.image_file_id",
    ),
    (
        "fuj_jmlp_posts.document_file_id",
        "SELECT COUNT(*) FROM fuj_jmlp_posts p "
        "JOIN fuj_jmlp_files f ON f.id = p.document_file_id",
        "SELECT COUNT(*) FROM fuj_jmlp_posts p "
        "JOIN fuj_jmlp_files f ON f.id = p.document_file_id "
        "JOIN fuj_jmlp_attachment a ON a.owner_type = 'post' AND a.owner_id = p.id "
        "AND a.role = 'document' AND a.file_id = p.document_file_id",
    ),
    (
        "fuj_jmlp_season_results",
        "SELECT COUNT(*) FROM fuj_jmlp_season_results sr "
        "JOIN fuj_jmlp_files f ON f.id = sr.document_id",
        "SELECT COUNT(*) FROM fuj_jmlp_season_results sr "
        "JOIN fuj_jmlp_files f ON f.id = sr.document_id "
        "JOIN fuj_jmlp_attachment a ON a.owner_type = 'season' "
        "AND a.owner_id = sr.season_year_start AND a.file_id = sr.document_id",
    ),
)


def _legacy_link_exists(conn, label: str) -> bool:
    """Existuje ještě zdroj, který má smysl kontrolovat?"""
    if label == "fuj_jmlp_season_results":
        return _table_exists(conn, "fuj_jmlp_season_results")
    table, column = label.split(".")
    return _column_exists(conn, table, column)


def _legacy_links_are_migrated(conn) -> bool:
    """Ověří, že každá vazba ze starých sloupců má protějšek v přílohách."""
    ok = True
    for label, column_query, attachment_query in _LEGACY_LINK_CHECKS:
        # Už zahozený sloupec není co ověřovat (a dotaz na něj by spadl).
        if not _legacy_link_exists(conn, label):
            continue
        in_column = conn.execute(text(column_query)).scalar() or 0
        in_attachments = conn.execute(text(attachment_query)).scalar() or 0
        if in_column != in_attachments:
            logger.error(
                "Úklid přeskočen: %s má %s vazeb, v přílohách jich je jen %s",
                label, in_column, in_attachments,
            )
            ok = False
    return ok


def _m_drop_legacy_file_links(conn):
    legacy_columns = (
        ("fuj_jmlp_race", "proposition_file_id"),
        ("fuj_jmlp_race", "results_file_id"),
        ("fuj_jmlp_posts", "image_file_id"),
        ("fuj_jmlp_posts", "document_file_id"),
    )
    remaining = [(t, c) for t, c in legacy_columns if _column_exists(conn, t, c)]
    season_results_exists = _table_exists(conn, "fuj_jmlp_season_results")

    if not remaining and not season_results_exists:
        return

    # Bez tabulky příloh nemá úklid co ověřit - jen by o data přišel.
    if not _table_exists(conn, "fuj_jmlp_attachment"):
        logger.error("Úklid přeskočen: fuj_jmlp_attachment neexistuje")
        return

    if not _legacy_links_are_migrated(conn):
        return

    for table, column in remaining:
        conn.execute(text(f"ALTER TABLE {table} DROP COLUMN {column}"))
        logger.info("Úklid: %s.%s odstraněn", table, column)

    if season_results_exists:
        conn.execute(text("DROP TABLE fuj_jmlp_season_results"))
        logger.info("Úklid: fuj_jmlp_season_results odstraněna")


# --------------------------------------------------------------------------
# 007 - knihovna dokumentů jako strom: sezóna -> podsložka -> soubor
#
# Dosud byla `fuj_jmlp_files.folder` volný text (např. "2025_propozice") a
# `fuj_jmlp_folders` plochý seznam názvů. Sezóna tedy byla jen konvence
# v názvu, ne skutečná úroveň, a soubor mohl ležet mimo jakoukoli sezónu.
#
# Nově:
#   fuj_jmlp_files.season_year  povinná sezóna (NULL = mimo knihovnu, viz níž)
#   fuj_jmlp_files.folder_id    podsložka v rámci sezóny; NULL = přímo v sezóně
#   fuj_jmlp_folders.season_year  do které sezóny podsložka patří
#
# Hloubka je záměrně jen jedna - podsložky se dál nevnořují.
#
# Loga klubů se v knihovně nezobrazují vůbec (spravují se v Admin -> Kluby),
# proto mají season_year NULL.
# --------------------------------------------------------------------------

# Sezóna se odvozuje z názvu složky, NE z data nahrání: archiv 2012-2024 byl
# hromadně naimportovaný v roce 2025, takže podle data nahrání by celý spadl
# do sezóny 2025. Datum nahrání je záloha jen pro soubory bez jiného vodítka.
_FOLDER_SEASON_SQL = """
    CASE
        WHEN f.folder REGEXP '^[0-9]{4}[_-]' THEN CAST(LEFT(f.folder, 4) AS UNSIGNED)
        WHEN f.folder REGEXP '^[0-9]{2}[_-][0-9]{2}[_-]' THEN 2000 + CAST(LEFT(f.folder, 2) AS UNSIGNED)
        ELSE NULL
    END
"""

# Sezóna podle data: hranice 1. 8., stejně jako utils.get_current_season_id()
_UPLOAD_SEASON_SQL = "YEAR(f.uploaded_at) - IF(MONTH(f.uploaded_at) >= 8, 0, 1)"


def _m_library_tree(conn):
    # Bez tabulky složek není co stavět - migrace 008 strom zase zrušila.
    # Musí se to poznat podle ní, ne podle season_year: ten 008 odstraňuje,
    # takže by se strom po každém restartu stavěl znovu (a spadl na složkách).
    if not _table_exists(conn, "fuj_jmlp_folders"):
        return
    if _column_exists(conn, "fuj_jmlp_files", "season_year"):
        return

    conn.execute(text(
        "ALTER TABLE fuj_jmlp_files "
        "ADD COLUMN season_year INT NULL DEFAULT NULL, "
        "ADD COLUMN folder_id BIGINT NULL DEFAULT NULL, "
        "ADD KEY idx_files_season (season_year), "
        "ADD KEY idx_files_folder (folder_id)"
    ))

    if not _column_exists(conn, "fuj_jmlp_folders", "season_year"):
        conn.execute(text(
            "ALTER TABLE fuj_jmlp_folders "
            "ADD COLUMN season_year INT NULL DEFAULT NULL, "
            "ADD KEY idx_folders_season (season_year)"
        ))

    # Název podsložky je unikátní až v rámci sezóny - "Propozice" existují
    # v každé sezóně. Staré UNIQUE(name) musí padnout ještě před přejmenováním.
    if _index_exists(conn, "fuj_jmlp_folders", "name"):
        conn.execute(text("ALTER TABLE fuj_jmlp_folders DROP INDEX name"))

    # 1) Staré složky rozpadnout na (sezóna, název podsložky)
    conn.execute(text("""
        UPDATE fuj_jmlp_folders SET
            season_year = CASE
                WHEN name REGEXP '^[0-9]{4}[_-]' THEN CAST(LEFT(name, 4) AS UNSIGNED)
                WHEN name REGEXP '^[0-9]{2}[_-][0-9]{2}[_-]' THEN 2000 + CAST(LEFT(name, 2) AS UNSIGNED)
                ELSE NULL
            END,
            name = CASE
                WHEN name REGEXP '^[0-9]{4}[_-]' THEN
                    CONCAT(UPPER(LEFT(SUBSTRING(name, 6), 1)), SUBSTRING(name, 7))
                WHEN name REGEXP '^[0-9]{2}[_-][0-9]{2}[_-]' THEN
                    CONCAT(UPPER(LEFT(SUBSTRING(name, 7), 1)), SUBSTRING(name, 8))
                ELSE name
            END
    """))

    # 2) Soubory napojit na podsložku a zdědit její sezónu
    conn.execute(text(f"""
        UPDATE fuj_jmlp_files f
        JOIN fuj_jmlp_folders d ON d.season_year = {_FOLDER_SEASON_SQL}
                              AND f.folder IS NOT NULL
                              AND LOWER(d.name) = LOWER(
                                  CASE
                                      WHEN f.folder REGEXP '^[0-9]{{4}}[_-]' THEN SUBSTRING(f.folder, 6)
                                      WHEN f.folder REGEXP '^[0-9]{{2}}[_-][0-9]{{2}}[_-]' THEN SUBSTRING(f.folder, 7)
                                      ELSE f.folder
                                  END)
        SET f.folder_id = d.id, f.season_year = d.season_year
    """))

    # 3) Soubory bez složky - sezónu vzít od toho, k čemu jsou připojené
    conn.execute(text("""
        UPDATE fuj_jmlp_files f
        JOIN fuj_jmlp_attachment a ON a.file_id = f.id AND a.owner_type = 'race'
        JOIN fuj_jmlp_race r ON r.id = a.owner_id
        SET f.season_year = r.season_id
        WHERE f.season_year IS NULL
    """))
    conn.execute(text("""
        UPDATE fuj_jmlp_files f
        JOIN fuj_jmlp_attachment a ON a.file_id = f.id AND a.owner_type = 'season'
        SET f.season_year = a.owner_id
        WHERE f.season_year IS NULL
    """))
    conn.execute(text("""
        UPDATE fuj_jmlp_files f
        JOIN fuj_jmlp_attachment a ON a.file_id = f.id AND a.owner_type = 'post'
        JOIN fuj_jmlp_posts p ON p.id = a.owner_id
        SET f.season_year = YEAR(p.created_at) - IF(MONTH(p.created_at) >= 8, 0, 1)
        WHERE f.season_year IS NULL
    """))

    # 4) Zbytek podle data nahrání
    conn.execute(text(f"""
        UPDATE fuj_jmlp_files f
        SET f.season_year = {_UPLOAD_SEASON_SQL}
        WHERE f.season_year IS NULL
    """))

    # 5) Loga klubů z knihovny ven
    conn.execute(text("""
        UPDATE fuj_jmlp_files f
        JOIN fuj_jmlp_attachment a ON a.file_id = f.id AND a.role = 'logo'
        SET f.season_year = NULL, f.folder_id = NULL
    """))

    # 5b) Známé názvy do české podoby (staré složky byly bez diakritiky)
    for old, new in (("Vysledky", "Výsledky"), ("Prubezne", "Průběžné")):
        conn.execute(text(
            "UPDATE fuj_jmlp_folders SET name = :new WHERE name = :old"
        ), {"old": old, "new": new})

    # 6) Teprve teď, když jsou názvy rozpadlé, jde omezení nasadit správně.
    # MyISAM neumí rollback, takže případný konflikt nesmí shodit celou migraci -
    # data už jsou v pořádku, chybělo by jen omezení.
    if not _index_exists(conn, "fuj_jmlp_folders", "uq_folder_season_name"):
        duplicates = conn.execute(text(
            "SELECT COUNT(*) FROM (SELECT season_year, name FROM fuj_jmlp_folders "
            "GROUP BY season_year, name HAVING COUNT(*) > 1) d"
        )).scalar()
        if duplicates:
            logger.warning(
                "Omezení uq_folder_season_name nenasazeno: %s duplicitních názvů složek v sezóně",
                duplicates,
            )
        else:
            conn.execute(text(
                "ALTER TABLE fuj_jmlp_folders "
                "ADD UNIQUE KEY uq_folder_season_name (season_year, name)"
            ))

    # 7) Sezóny, na které knihovna odkazuje, musí existovat
    conn.execute(text("""
        INSERT IGNORE INTO fuj_jmlp_season (year_start, year_end, edition, name, active)
        SELECT DISTINCT f.season_year, f.season_year + 1, f.season_year - :base,
               'Jihomoravský lyžařský pohár', 1
        FROM fuj_jmlp_files f
        WHERE f.season_year IS NOT NULL
    """), {"base": EDITION_BASE_YEAR})

    stats = conn.execute(text("""
        SELECT COUNT(*) AS celkem,
               SUM(season_year IS NULL) AS mimo_knihovnu,
               SUM(folder_id IS NULL AND season_year IS NOT NULL) AS primo_v_sezone
        FROM fuj_jmlp_files
    """)).first()
    logger.info(
        "Migrace: knihovna jako strom - %s souborů, %s mimo knihovnu, %s přímo v sezóně",
        stats.celkem, stats.mimo_knihovnu, stats.primo_v_sezone,
    )


# --------------------------------------------------------------------------
# 008 - plochá knihovna: systematické názvy, konec složek
#
# Ruší strom sezóna -> podsložka -> soubor. Kam soubor patří, říká příloha
# (fuj_jmlp_attachment), jak se jmenuje, říká systematický název odvozený
# z prvního připojení. Složka byla třetí, ručně udržovaná odpověď na tutéž
# otázku - a jediná, kterou nikdo neaktualizoval.
#
# fuj_jmlp_attachment.title padá taky: byl to druhý název téhož souboru.
#
# Pořadí kroků je závazné - nejdřív přejmenovat, teprve pak zahodit.
# MyISAM neumí rollback, takže půlka migrace zůstane, kde spadne; po DROPu
# by navíc už nebylo z čeho názvy odvodit.
# --------------------------------------------------------------------------
def _m_flat_library(conn):
    # attachment.title padá vždycky, i když databáze stromovou knihovnou nikdy
    # neprošla: nový model ho nezná a _m_attachments ho zakládá prázdný.
    # Dřív viselo zahození pod podmínkou folder_id níž, takže na databázi bez
    # složek (ostrý web) sloupec zůstal a schéma se rozešlo se zdejším.
    if _column_exists(conn, "fuj_jmlp_attachment", "title"):
        conn.execute(text("ALTER TABLE fuj_jmlp_attachment DROP COLUMN title"))

    if not _column_exists(conn, "fuj_jmlp_files", "folder_id"):
        return

    _titles_into_filenames(conn)
    renamed = _rename_attached_files(conn)
    disambiguated = _deduplicate_filenames(conn)

    for column in ("season_year", "folder_id", "folder"):
        if _column_exists(conn, "fuj_jmlp_files", column):
            conn.execute(text(f"ALTER TABLE fuj_jmlp_files DROP COLUMN {column}"))

    if _table_exists(conn, "fuj_jmlp_folders"):
        conn.execute(text("DROP TABLE fuj_jmlp_folders"))

    logger.info(
        "Migrace: plochá knihovna - %s souborů přejmenováno, %s odlišeno kvůli shodě názvů",
        renamed, disambiguated,
    )


def _titles_into_filenames(conn) -> None:
    """Popisek přílohy, který se liší od názvu souboru, přenese do názvu.

    Jinak by se s title ztratil - u části souborů to byl jediný čitelný
    název, zatímco soubor sám se jmenoval třeba "dokument1.pdf". Rozhoduje
    popisek z nejstarší přílohy, příponu dodá skutečný soubor na disku.
    """
    if not _column_exists(conn, "fuj_jmlp_attachment", "title"):
        return

    conn.execute(text("""
        UPDATE fuj_jmlp_files f
        JOIN (
            SELECT file_id, MIN(id) AS first_id FROM fuj_jmlp_attachment
            WHERE title IS NOT NULL AND title <> '' GROUP BY file_id
        ) prvni ON prvni.file_id = f.id
        JOIN fuj_jmlp_attachment a ON a.id = prvni.first_id
        SET f.original_filename = CONCAT(
            a.title,
            CASE WHEN a.title LIKE CONCAT('%.', SUBSTRING_INDEX(f.filename, '.', -1))
                 THEN '' ELSE CONCAT('.', SUBSTRING_INDEX(f.filename, '.', -1)) END
        )
        WHERE a.title <> f.original_filename
    """))


def _rename_attached_files(conn) -> int:
    """Systematický název pro každý soubor, který někam patří.

    Skládá se v Pythonu, ne v SQL - název umí services/naming.py a druhá
    implementace v SQL by se s ní dřív nebo později rozešla.

    Rozhoduje nejstarší příloha souboru, tedy místo prvního připojení.
    Soubory bez přílohy a soubory jen v knihovně si název nechávají -
    není z čeho ho odvodit.
    """
    from .services.naming import owner_stem, role_suffix, unique_name

    rows = conn.execute(text("""
        SELECT a.owner_type, a.owner_id, a.role,
               f.id AS file_id, f.filename, f.original_filename
        FROM fuj_jmlp_attachment a
        JOIN fuj_jmlp_files f ON f.id = a.file_id
        JOIN (
            SELECT file_id, MIN(id) AS first_id
            FROM fuj_jmlp_attachment
            WHERE owner_type <> 'library'
            GROUP BY file_id
        ) prvni ON prvni.first_id = a.id
        ORDER BY a.id
    """)).fetchall()

    taken = _taken_filenames(conn)

    renamed = 0
    for row in rows:
        stem = owner_stem(
            row.owner_type, row.owner_id, _owner_row(conn, row.owner_type, row.owner_id)
        )
        if not stem:
            continue

        # Přípona podle souboru na disku, ne podle názvu - ten se právě mění.
        extension = Path(row.filename or "").suffix.lower()
        # Vlastní název ze zabraných ven, jinak by si soubor stál v cestě
        # sám a dostal pořadové číslo, i když je jediný svého jména.
        taken.discard((row.original_filename or "").lower())
        new_name = unique_name(f"{stem}_{role_suffix(row.role)}", extension, taken)
        taken.add(new_name.lower())

        if new_name != row.original_filename:
            _rename_file(conn, row.file_id, new_name)
            renamed += 1

    return renamed


def _deduplicate_filenames(conn) -> int:
    """Zbylé shodné názvy odliší pořadovým číslem.

    Soubor, který nikam nepatří, si název nechává - jenže dva takové se
    můžou jmenovat stejně, a v ploché knihovně je název to jediné, čím se
    soubor pozná (přejmenování v knihovně shodu odmítá). Název si podrží
    ten s nižším id, další dostanou -2, -3, ...
    """
    from .services.naming import unique_name

    rows = conn.execute(text(
        "SELECT id, original_filename FROM fuj_jmlp_files ORDER BY id"
    )).fetchall()

    taken = set()
    renamed = 0
    for file_id, name in rows:
        if not name:
            continue
        if name.lower() not in taken:
            taken.add(name.lower())
            continue

        current = Path(name)
        new_name = unique_name(current.stem, current.suffix, taken)
        taken.add(new_name.lower())
        _rename_file(conn, file_id, new_name)
        renamed += 1

    return renamed


def _taken_filenames(conn) -> set:
    """Obsazené názvy souborů, malými písmeny - kolace je case-insensitive."""
    return {
        row[0].lower()
        for row in conn.execute(text("SELECT original_filename FROM fuj_jmlp_files"))
        if row[0]
    }


def _owner_row(conn, owner_type: str, owner_id) -> object:
    """Řádek vlastníka pro owner_stem(). Sezóně a článku stačí id."""
    if owner_type == "race":
        return conn.execute(
            text("SELECT race_nr FROM fuj_jmlp_race WHERE id = :id"), {"id": owner_id}
        ).first()
    if owner_type == "club":
        return conn.execute(
            text("SELECT name FROM fuj_jmlp_club WHERE id = :id"), {"id": owner_id}
        ).first()
    return None


def _rename_file(conn, file_id: int, new_name: str) -> None:
    conn.execute(
        text("UPDATE fuj_jmlp_files SET original_filename = :name WHERE id = :id"),
        {"name": new_name, "id": file_id},
    )


# --------------------------------------------------------------------------
# 009 - vyřazení ze startovky
#
# Závodník, který nedorazil nebo nestihl start, se ze startovky nemaže -
# když pak přece jen dorazí, musel by ho časoměřič zakládat znovu a přišel by
# o startovní číslo i dres. Místo toho dostane příznak `excluded`: zmizí ze
# startovky, ze zadávání časů, z výsledků i z bodů, ale tlačítkem "Vrátit" se
# obnoví i se vším, co u něj bylo zapsané.
#
# Výchozí 0 znamená, že dosavadní řádky zůstávají tam, kde byly.
# --------------------------------------------------------------------------
def _m_start_list_excluded(conn):
    if not _table_exists(conn, "fuj_jmlp_race_start_list"):
        return
    if _column_exists(conn, "fuj_jmlp_race_start_list", "excluded"):
        return
    conn.execute(text(
        "ALTER TABLE fuj_jmlp_race_start_list "
        "ADD COLUMN excluded TINYINT(1) NOT NULL DEFAULT 0"
    ))
    logger.info("Migrace: fuj_jmlp_race_start_list.excluded")


# --------------------------------------------------------------------------
# 010 - finálový závod poháru
#
# Soutěžní řád: při shodě bodů v pořadí poháru rozhoduje nakonec umístění
# ve finálovém závodě a pořadí ho vede ve sloupci "F" (F01.03). Závod na
# sněhu se jako finále označí v administraci.
# --------------------------------------------------------------------------
def _m_race_is_final(conn):
    if not _table_exists(conn, "fuj_jmlp_race"):
        return
    if _column_exists(conn, "fuj_jmlp_race", "is_final"):
        return
    conn.execute(text(
        "ALTER TABLE fuj_jmlp_race "
        "ADD COLUMN is_final TINYINT(1) NOT NULL DEFAULT 0"
    ))
    logger.info("Migrace: fuj_jmlp_race.is_final")


# --------------------------------------------------------------------------
# 011 - párování závodníků s evidencí SLČR
#
# Návrh člena evidence SLČR (evidence.czech-ski.com) ke každému našemu
# závodníkovi a rozhodnutí správce. Registr závodníků se tím nemění - ani
# "ID závodníka", které je odpovědností závodníka; párování jen ukáže,
# kde nesouhlasí s evidencí. Druhá tabulka drží běhy načítání (běží na
# pozadí a správce sleduje průběh).
# --------------------------------------------------------------------------
def _m_slcr_pairing(conn):
    # Agenda párování byla zrušena (migrace 013) - tabulky už nezakládat.
    if _table_exists(conn, "fuj_jmlp_slcr_member"):
        return
    if not _table_exists(conn, "fuj_jmlp_racer_slcr"):
        conn.execute(text("""
            CREATE TABLE fuj_jmlp_racer_slcr (
                racer_id BIGINT NOT NULL PRIMARY KEY,
                status VARCHAR(12) NOT NULL,
                member_id INT DEFAULT NULL,
                member_slug VARCHAR(160) DEFAULT NULL,
                race_code INT DEFAULT NULL,
                slcr_surname VARCHAR(80) DEFAULT NULL,
                slcr_name VARCHAR(80) DEFAULT NULL,
                slcr_year INT DEFAULT NULL,
                slcr_club VARCHAR(200) DEFAULT NULL,
                confidence VARCHAR(8) DEFAULT NULL,
                source VARCHAR(12) DEFAULT NULL,
                note VARCHAR(400) DEFAULT NULL,
                alternatives TEXT,
                checked_at DATETIME DEFAULT NULL,
                decided_at DATETIME DEFAULT NULL,
                decided_by BIGINT DEFAULT NULL,
                KEY ix_racer_slcr_member (member_id),
                KEY ix_racer_slcr_status (status)
            ) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """))
        logger.info("Migrace: fuj_jmlp_racer_slcr")
    if not _table_exists(conn, "fuj_jmlp_slcr_sync"):
        conn.execute(text("""
            CREATE TABLE fuj_jmlp_slcr_sync (
                id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                scope VARCHAR(10) NOT NULL,
                started_at DATETIME NOT NULL,
                finished_at DATETIME DEFAULT NULL,
                total INT NOT NULL DEFAULT 0,
                done INT NOT NULL DEFAULT 0,
                error VARCHAR(500) DEFAULT NULL,
                started_by BIGINT DEFAULT NULL
            ) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """))
        logger.info("Migrace: fuj_jmlp_slcr_sync")


# --------------------------------------------------------------------------
# 012 - převzetí údajů z evidence SLČR při potvrzení párování
#
# Potvrzení párování opraví náš záznam podle evidence (jméno, příjmení,
# ročník, ID závodníka). Původní hodnoty se uloží, aby "Vrátit" mohlo
# změnu vzít zpět.
# --------------------------------------------------------------------------
def _m_slcr_applied(conn):
    if not _table_exists(conn, "fuj_jmlp_racer_slcr"):
        return
    if not _column_exists(conn, "fuj_jmlp_racer_slcr", "previous"):
        conn.execute(text("ALTER TABLE fuj_jmlp_racer_slcr ADD COLUMN previous TEXT"))
    if not _column_exists(conn, "fuj_jmlp_racer_slcr", "applied_at"):
        conn.execute(text("ALTER TABLE fuj_jmlp_racer_slcr ADD COLUMN applied_at DATETIME DEFAULT NULL"))
    logger.info("Migrace: fuj_jmlp_racer_slcr.previous, applied_at")


# --------------------------------------------------------------------------
# 013 - propojení se SLČR jen jako odkaz
#
# Agenda párování se SLČR byla zrušena (11. 10. 2026) - data se jednorázově
# pročistila a dál se v databázi nic automaticky neopravuje. Zůstává jen
# odkaz ze jména závodníka na kartu člena v evidenci. K tomu stačí tabulka
# známých členů (ID v evidenci, adresa karty, ID závodníka, jméno, ročník);
# naplní se z dosavadního párování a tabulky párování se zruší.
# --------------------------------------------------------------------------
def _m_slcr_member_links(conn):
    if not _table_exists(conn, "fuj_jmlp_slcr_member"):
        conn.execute(text("""
            CREATE TABLE fuj_jmlp_slcr_member (
                member_id INT NOT NULL PRIMARY KEY,
                slug VARCHAR(160) DEFAULT NULL,
                race_code INT DEFAULT NULL,
                surname VARCHAR(80) DEFAULT NULL,
                name VARCHAR(80) DEFAULT NULL,
                year INT DEFAULT NULL,
                KEY ix_slcr_member_code (race_code)
            ) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
        """))
        logger.info("Migrace: fuj_jmlp_slcr_member")
    if _table_exists(conn, "fuj_jmlp_racer_slcr"):
        # Ročník: z evidence, jinak náš ročník spárovaného závodníka (párování
        # ho ověřilo proti věku z evidence).
        conn.execute(text("""
            INSERT IGNORE INTO fuj_jmlp_slcr_member (member_id, slug, race_code, surname, name, year)
            SELECT p.member_id, p.member_slug, p.race_code, p.slcr_surname, p.slcr_name, COALESCE(p.slcr_year, r.year)
            FROM fuj_jmlp_racer_slcr p
            JOIN fuj_jmlp_racer r ON r.id = p.racer_id
            WHERE p.member_id IS NOT NULL AND p.status IN ('confirmed', 'filled')
        """))
        conn.execute(text("DROP TABLE fuj_jmlp_racer_slcr"))
        logger.info("Migrace: fuj_jmlp_racer_slcr -> fuj_jmlp_slcr_member, párování zrušeno")
    if _table_exists(conn, "fuj_jmlp_slcr_sync"):
        conn.execute(text("DROP TABLE fuj_jmlp_slcr_sync"))


# --------------------------------------------------------------------------
# 014 - délka trati jako text
#
# LiZa má v hlavičce listiny délku trati volným textem ("400m, 7 stanovišť",
# "350,700,1050,1500,2000,2500 m"); číslo v metrech to neuneslo. Stávající
# čísla zůstanou (120 -> "120"), tisk k samotnému číslu dál doplní "m".
# --------------------------------------------------------------------------
def _m_course_length_text(conn):
    if not _column_exists(conn, "fuj_jmlp_race_run", "course_length_m"):
        return
    column_type = conn.execute(text("""
        SELECT DATA_TYPE FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fuj_jmlp_race_run'
          AND COLUMN_NAME = 'course_length_m'
    """)).scalar()
    if column_type == "varchar":
        return
    conn.execute(text(
        "ALTER TABLE fuj_jmlp_race_run MODIFY course_length_m VARCHAR(60) "
        "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL"
    ))
    logger.info("Migrace: fuj_jmlp_race_run.course_length_m jako text")


# --------------------------------------------------------------------------
# 015 - systémové označení čísel písmenem sady ("B12" místo 212)
#
# fuj_jmlp_race_numbers.display_number i snapshot ve startovkách
# (race_number_display) se z čísla mění na text: písmeno sady (1 = A,
# 2 = B, ...) + číslo dresu. Vazba startovky na číselník je race_number_id;
# snapshot se přepočítá podle ní, u řádků bez vazby podle starého čísla.
# --------------------------------------------------------------------------
def _column_data_type(conn, table: str, column: str):
    return conn.execute(text("""
        SELECT DATA_TYPE FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column
    """), {"table": table, "column": column}).scalar()


def _m_race_number_codes(conn):
    if not _table_exists(conn, "fuj_jmlp_race_numbers"):
        return
    if _column_data_type(conn, "fuj_jmlp_race_numbers", "display_number") == "varchar":
        return
    code = "CONCAT(CHAR(64 + rn.set_number USING ascii), rn.actual_number)"
    has_start_list = _column_exists(conn, "fuj_jmlp_race_start_list", "race_number_display")
    if has_start_list:
        conn.execute(text(
            "ALTER TABLE fuj_jmlp_race_start_list MODIFY race_number_display VARCHAR(8) NULL DEFAULT NULL"
        ))
        # Podle vazby na číselník.
        conn.execute(text(f"""
            UPDATE fuj_jmlp_race_start_list sl
            JOIN fuj_jmlp_race_numbers rn ON rn.id = sl.race_number_id
            SET sl.race_number_display = {code}
        """))
        # Bez vazby (číslo mezitím smazané): podle starého systémového čísla.
        conn.execute(text(f"""
            UPDATE fuj_jmlp_race_start_list sl
            JOIN fuj_jmlp_race_numbers rn ON rn.display_number = CAST(sl.race_number_display AS UNSIGNED)
            SET sl.race_number_display = {code}
            WHERE sl.race_number_id IS NULL AND sl.race_number_display REGEXP '^[0-9]+$'
        """))
        conn.execute(text(
            "UPDATE fuj_jmlp_race_start_list SET race_number_display = NULL "
            "WHERE race_number_display REGEXP '^[0-9]+$'"
        ))
    conn.execute(text("ALTER TABLE fuj_jmlp_race_numbers MODIFY display_number VARCHAR(8) NOT NULL"))
    conn.execute(text(f"UPDATE fuj_jmlp_race_numbers rn SET rn.display_number = {code}"))
    logger.info("Migrace: systémová čísla jako písmeno sady + dres (B12)")


# --------------------------------------------------------------------------
# 016 - číslo dresu už jen v označení
#
# Po migraci 015 je číslo dresu vždy obsažené v označení (B12 -> 12), takže
# sloupce fuj_jmlp_race_numbers.actual_number a snapshot
# fuj_jmlp_race_start_list.race_number_actual jsou zbytečné. Aplikace číslo
# dresu odvozuje (models.RaceNumber.actual_number, CAST(SUBSTRING(..., 2)).
# Zahodí se jen tehdy, když všude souhlasí s označením - jinak se nic nesmaže.
# --------------------------------------------------------------------------
def _m_drop_actual_numbers(conn):
    if _column_exists(conn, "fuj_jmlp_race_numbers", "actual_number"):
        mismatch = conn.execute(text("""
            SELECT COUNT(*) FROM fuj_jmlp_race_numbers
            WHERE display_number NOT REGEXP '^[A-Z][0-9]+$'
               OR CAST(SUBSTRING(display_number, 2) AS UNSIGNED) <> actual_number
        """)).scalar()
        if mismatch:
            logger.warning("Migrace 016 přeskočena: %s čísel nesouhlasí s označením", mismatch)
            return
        # Indexy nad dresem (v produkci "unique_set_actual", v novějších
        # instalacích "uq_race_numbers_set_actual") - jinak by po zrušení
        # sloupce zbyl unikátní index jen nad set_number a ALTER by spadl.
        indexes = [row[0] for row in conn.execute(text("""
            SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fuj_jmlp_race_numbers'
              AND COLUMN_NAME = 'actual_number'
        """))]
        for index in indexes:
            conn.execute(text(f"ALTER TABLE fuj_jmlp_race_numbers DROP INDEX `{index}`"))
        conn.execute(text("ALTER TABLE fuj_jmlp_race_numbers DROP COLUMN actual_number"))
        logger.info("Migrace: fuj_jmlp_race_numbers.actual_number zrušen")
    if _column_exists(conn, "fuj_jmlp_race_start_list", "race_number_actual"):
        mismatch = conn.execute(text("""
            SELECT COUNT(*) FROM fuj_jmlp_race_start_list
            WHERE race_number_actual IS NOT NULL AND (
                race_number_display IS NULL
                OR CAST(SUBSTRING(race_number_display, 2) AS UNSIGNED) <> race_number_actual)
        """)).scalar()
        if mismatch:
            logger.warning("Migrace 016: %s řádků startovek má dres bez označení - sloupec zůstává", mismatch)
            return
        conn.execute(text("ALTER TABLE fuj_jmlp_race_start_list DROP COLUMN race_number_actual"))
        logger.info("Migrace: fuj_jmlp_race_start_list.race_number_actual zrušen")


MIGRATIONS = (
    _m_legacy_schema,
    _m_registration_club_request_note,
    _m_attachments,
    _m_seasons,
    _m_category_display_name,
    _m_race_header,
    _m_race_run,
    _m_drop_legacy_file_links,
    _m_library_tree,
    _m_flat_library,
    _m_start_list_excluded,
    _m_race_is_final,
    _m_slcr_pairing,
    _m_slcr_applied,
    _m_slcr_member_links,
    _m_course_length_text,
    _m_race_number_codes,
    _m_drop_actual_numbers,
)


# Uvicorn běží s víc workery a každý si při startu pustí migrace. Bez zámku
# je spouštějí souběžně: jeden zahodí sloupec zrovna mezi kontrolou existence
# a dotazem druhého, který pak spadne na "Unknown column" a shodí start.
_MIGRATION_LOCK = "jmlp_migrations"
_MIGRATION_LOCK_TIMEOUT_SECONDS = 60


def run_migrations() -> None:
    """Spustí všechny migrace. Každá je idempotentní.

    Celý běh drží pojmenovaný zámek MySQL, takže ostatní workery počkají
    a uvidí až výsledný stav schématu.
    """
    from .database import engine

    with engine.connect() as conn:
        acquired = conn.execute(
            text("SELECT GET_LOCK(:name, :timeout)"),
            {"name": _MIGRATION_LOCK, "timeout": _MIGRATION_LOCK_TIMEOUT_SECONDS},
        ).scalar()

        if acquired != 1:
            # Migrace právě běží v jiném workeru a nestihly se do timeoutu.
            # Vyhazovat chybu by shodilo start; schéma dorovná ten druhý.
            logger.warning("Migrace přeskočeny: zámek %s se nepodařilo získat", _MIGRATION_LOCK)
            return

        try:
            for migration in MIGRATIONS:
                try:
                    migration(conn)
                    conn.commit()
                except Exception:
                    conn.rollback()
                    logger.exception("Migrace %s selhala", migration.__name__)
                    raise
        finally:
            conn.execute(text("SELECT RELEASE_LOCK(:name)"), {"name": _MIGRATION_LOCK})
