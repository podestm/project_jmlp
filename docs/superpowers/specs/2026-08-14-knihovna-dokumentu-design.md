# Knihovna dokumentů — zjednodušení

*Návrh, 14. 8. 2026*

## Proč

Knihovna dokumentů se dostala do stavu, kdy je složitější, než k čemu slouží.
Prošla třemi podobami — volný textový sloupec `folder`, pak vizuální seskupení
odvozené z názvu složky, pak strom sezóna → podsložka → soubor. Každá vrstva
řešila skutečný problém, ale dohromady vznikla struktura, kterou je potřeba
udržovat a která uživateli nic nedává: soubor se hledá podle názvu a podle
toho, k čemu patří, ne podle toho, ve které složce leží.

Zároveň chybí dvě věci, které uživatel potřebuje denně: poznat, k čemu je
soubor připojený, a dostat soubory hromadně ven.

Cíl: soubor se nahraje tam, kam patří, dostane systematický název a v knihovně
se dohledá filtrem. Žádné složky, žádné řazení, žádná hierarchie.

## Co se ruší

| Co | Proč |
|---|---|
| `fuj_jmlp_files.season_year` | sezóna je vazba, ne vlastnost souboru |
| `fuj_jmlp_files.folder_id` | složky se ruší |
| `fuj_jmlp_files.folder` | legacy sloupec, už se nečte |
| tabulka `fuj_jmlp_folders` | složky se ruší |
| `DocumentLibrary.jsx` — strom | nahradí plochá tabulka s filtry |
| `services/library.py` — `build_tree`, `create_folder`, `move_files` | bez složek nemá co dělat |

Zůstává `fuj_jmlp_files` (soubor) a `fuj_jmlp_attachment` (k čemu patří).
Soubor může viset na víc objektech — dnes je takových pět.

## Systematické pojmenování

Název se spočítá **při prvním připojení** a zapíše se do `original_filename`.
Dál se nemění, ani když se závod přejmenuje — soubor si název nese.

```
Závod    JMLP2025-05_propozice.pdf
         JMLP2025-05_vysledky.pdf
Sezóna   sezona-2025-2026_vysledky.pdf
         sezona-2025-2026_dokument.pdf
Klub     klub-freeski-academy-brno_logo.png
Článek   clanek-6_obrazek.jpg
         clanek-6_dokument.pdf
```

Pravidla: bez diakritiky, mezery na pomlčky, malá písmena kromě kódu závodu.
Při kolizi se připojí `-2`, `-3`. Přípona se zachová z nahraného souboru.

**Sezóna může mít víc obecných dokumentů** (soutěžní řád, pokyny pro
organizátory), takže druhý dostane `sezona-2025-2026_dokument-2.pdf`. To je
v pořádku jako název souboru, ale ne jako popisek na webu — veřejná stránka
proto zobrazuje `attachment.title`, který admin vyplní při nahrání. Když ho
nevyplní, zobrazí se název souboru. Pole na název je proto v sekci
„Dokumenty na webu" povinné.

Jedna funkce `systematic_filename(db, owner_type, owner_id, role, extension)`
v `services/files.py`, volaná z jediného místa — z endpointu pro nahrání
přílohy. Nikde jinde se název neskládá.

Původní uživatelský název se zahazuje. Na disku stejně leží UUID, takže
provenience se neztrácí nikde, kde by na ní záleželo.

## Knihovna

`GET /api/admin/library` vrací plochý seznam. Filtruje se na serveru:

| Parametr | Význam |
|---|---|
| `q` | podřetězec v názvu |
| `extension` | `pdf`, `jpg`, … |
| `owner_type` | `race`, `post`, `season`, `club`, `library` (nezaložené) |
| `date_from`, `date_to` | datum nahrání, oba konce včetně |

Odpověď u každého souboru nese `usage_info` — seznam objektů, na kterých visí,
včetně toho, jestli je vazba zveřejněná. Frontend je jedna tabulka a řádek
filtrů; žádný strom, žádné přetahování, žádné pořadí.

Sloupce: název, přípona, velikost, datum nahrání, kde je použitý, akce
(stáhnout, smazat).

## Hromadné stažení

`GET /api/admin/library/export.zip` bere **stejné filtry** jako výpis, takže
„stáhnout vše" a „stáhnout vyfiltrované" je jeden endpoint — bez filtru vrátí
všechno.

ZIP se skládá do dočasného souboru na disku a odešle se přes `FileResponse`.
Do paměti se neskládá: 80 MB krát dva uvicorn workery by na dvoujádrovém
stroji bylo znát. Po odeslání se dočasný soubor smaže.

Struktura uvnitř ZIPu podle vazby — v aplikaci složky nejsou, v archivu dávají
smysl:

```
jmlp-dokumenty-2026-08-14.zip
  zavody/JMLP2025-05_propozice.pdf
  sezony/sezona-2025-2026_vysledky.pdf
  kluby/klub-freeski-academy-brno_logo.png
  clanky/clanek-6_obrazek.jpg
  nezarazene/Jmlp.jpg
```

Soubor připojený k víc objektům se do ZIPu dá jednou, do složky vlastníka
s nejnižším `attachment.id` — tedy toho, ke kterému byl připojen jako první.

## Veřejné dokumenty na /dokumenty

Tahle část **už funguje**, jen to není poznat — proto se nemění mechanismus,
ale popisky a dohledatelnost.

Jak to je: veřejná stránka `/dokumenty` čte přílohy sezóny s rolí `document`
a příznakem `published`. V administraci se spravují v **Sezóny → rozbalit
sezónu → sekce Dokument**, kde už je nahrávání i přepínač zveřejnění.

Co se doplní:

1. Popisek sekce v `SeasonManagement` z obecného „Dokument" na
   **„Dokumenty na webu (/dokumenty)"** s nápovědou, že přepínač řídí
   zveřejnění.
2. V knihovně filtr `owner_type=season` a **odznak „veřejný"** u souborů,
   které jsou zveřejněné jako dokument sezóny.
3. V knihovně akce **„Zveřejnit na webu"** — připojí existující soubor
   k vybrané sezóně jako veřejný dokument, aby se nemusel nahrávat znovu.

Pořadí na veřejné stránce drží `attachment.sort_order`, skupinu určuje sezóna,
takže se dokumenty samy třídí po ročnících. Nic z toho není nové.

## Migrace

1. Záloha databáze.
2. Přejmenovat připojené soubory (206) systematickým názvem. Nezaložené (24)
   si nechají původní název — není z čeho ho odvodit.
3. Kolize názvů ošetřit pořadovým číslem.
4. Zahodit `season_year`, `folder_id`, `folder` a tabulku `fuj_jmlp_folders`.

Migrace běží pod zámkem `jmlp_migrations` jako ostatní. MyISAM neumí rollback,
takže destruktivní krok jde až po přejmenování a jen když přejmenování prošlo.

## Chybové stavy

| Situace | Chování |
|---|---|
| Kolize systematického názvu | přípona `-2`, `-3` |
| Neznámý `owner_type` ve filtru | 400 s výčtem povolených |
| Prázdný výsledek exportu | 404 „Filtru neodpovídá žádný soubor" |
| Smazání použitého souboru | 409 s výpisem, kde je použitý (`?force=true` obejde) |
| Vlastník smazán, příloha zůstala | soubor se ve výpisu chová jako nezaložený |

## Ověření

- Migrace dvakrát po sobě — musí být idempotentní.
- Po migraci: 238 souborů, 0 odkazů na neexistující složku, žádné dva soubory
  se stejným systematickým názvem.
- Nahrát soubor ke každému ze čtyř míst a zkontrolovat výsledný název.
- Filtry: každý zvlášť i v kombinaci; počet v exportu musí sedět s výpisem.
- ZIP: rozbalit, ověřit strukturu a že soubor na dvou objektech je uvnitř jednou.
- `/dokumenty` po zveřejnění dokumentu sezóny ukáže položku a stáhne ji.
- Veřejné API (`/races/…`, `/posts/…`, `/season-results/`) beze změny.

## Co se nedělá

- Verzování souborů.
- Náhledy PDF v knihovně.
- Přejmenování souboru ručně — název je systematický, ruční zásah by ho rozbil.
- Zpětné přejmenování při změně čísla závodu — název je dán prvním připojením.
