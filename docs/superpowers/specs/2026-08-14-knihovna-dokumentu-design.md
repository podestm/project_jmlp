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
| `fuj_jmlp_attachment.title` | druhý název pro tentýž soubor; nahrazuje ho název souboru |

Zůstává `fuj_jmlp_files` (soubor) a `fuj_jmlp_attachment` (k čemu patří).
Soubor může viset na víc objektech — dnes je takových pět.

## Systematické pojmenování

Název se spočítá **při prvním připojení** a zapíše se do `original_filename`.
Je to **výchozí název, ne zámek** — v knihovně jde kdykoli přepsat (viz
Přejmenování). Sám od sebe se nemění, ani když se závod přejmenuje.

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
organizátory), takže druhý dostane `sezona-2025-2026_dokument-2.pdf`. Jako
název souboru to stačí, jako popisek na webu ne — proto se takový dokument
po nahrání přejmenuje na „Soutěžní řád XIX. ročník".

**Soubor má jediný název.** Dřívější `attachment.title` se ruší: byl to druhý
název téhož souboru a přesně takové zdvojení dělalo v knihovně nepořádek.
Název souboru je zároveň popisek na webu, v knihovně i všude jinde.

Jedna funkce `systematic_filename(db, owner_type, owner_id, role, extension)`
v `services/files.py`, volaná z jediného místa — z endpointu pro nahrání
přílohy. Nikde jinde se název neskládá.

Původní uživatelský název se zahazuje. Na disku stejně leží UUID, takže
provenience se neztrácí nikde, kde by na ní záleželo.

## Přejmenování

Kterýkoli soubor jde v knihovně přejmenovat:
`PUT /api/admin/library/files/{id}` s `{"name": "…"}`.

Pravidla:

- **Příponu určuje soubor, ne uživatel.** Zadaná přípona se zahodí a připojí se
  skutečná — jinak by `.pdf` přejmenovaný na `.jpg` rozbil stahování.
- Oddělovače cest (`/`, `\`) a řídicí znaky se odstraní.
- Prázdný název se odmítne (400).
- Kolize s existujícím názvem se odmítne (409) — na rozdíl od automatického
  pojmenování se tady nic tiše nečísluje, uživatel má název v ruce.
- Diakritika je povolená; na disku leží UUID, takže název souboru na nic
  citlivého nesahá.

Ruční název má přednost: systematické pojmenování se aplikuje jen při prvním
připojení, přejmenovaný soubor se už nikdy sám nepřepíše.

## Knihovna

`GET /api/admin/library` vrací plochý seznam. Vyhledávání podle názvu je vždy
k dispozici. Filtruje se na serveru:

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
(stáhnout, přejmenovat, smazat). Přejmenování je inline v řádku.

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
   zveřejnění a že název souboru je zároveň popisek na webu.
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
4. Kde je vyplněný `attachment.title` a liší se od názvu souboru, přenést ho
   do názvu souboru — jinak by se ztratil popisek, který někdo vyplnil.
5. Zahodit `season_year`, `folder_id`, `folder`, `attachment.title`
   a tabulku `fuj_jmlp_folders`.

Migrace běží pod zámkem `jmlp_migrations` jako ostatní. MyISAM neumí rollback,
takže destruktivní krok jde až po přejmenování a jen když přejmenování prošlo.

## Chybové stavy

| Situace | Chování |
|---|---|
| Kolize systematického názvu | přípona `-2`, `-3` |
| Kolize při ručním přejmenování | 409, uživatel zvolí jiný název |
| Prázdný název při přejmenování | 400 |
| Neznámý `owner_type` ve filtru | 400 s výčtem povolených |
| Prázdný výsledek exportu | 404 „Filtru neodpovídá žádný soubor" |
| Smazání použitého souboru | 409 s výpisem, kde je použitý (`?force=true` obejde) |
| Vlastník smazán, příloha zůstala | soubor se ve výpisu chová jako nezaložený |

## Ověření

- Migrace dvakrát po sobě — musí být idempotentní.
- Po migraci: 238 souborů, 0 odkazů na neexistující složku, žádné dva soubory
  se stejným systematickým názvem.
- Nahrát soubor ke každému ze čtyř míst a zkontrolovat výsledný název.
- Přejmenovat soubor, ověřit zachování přípony, odmítnutí duplicity i prázdna,
  a že se název po dalším připojení nepřepíše.
- Vyhledat podle názvu, včetně diakritiky a části slova.
- Filtry: každý zvlášť i v kombinaci; počet v exportu musí sedět s výpisem.
- ZIP: rozbalit, ověřit strukturu a že soubor na dvou objektech je uvnitř jednou.
- `/dokumenty` po zveřejnění dokumentu sezóny ukáže položku pod názvem souboru
  a stáhne ji.
- Veřejné API (`/races/…`, `/posts/…`, `/season-results/`) beze změny.

## Co se nedělá

- Verzování souborů.
- Náhledy PDF v knihovně.
- Zpětné přejmenování při změně čísla závodu — název je dán prvním připojením
  a dál jen ručním zásahem.
- Změna přípony při přejmenování — přípona se drží skutečného souboru.
