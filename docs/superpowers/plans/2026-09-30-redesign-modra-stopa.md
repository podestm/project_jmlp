# Redesign „Modrá stopa“ — plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Převést veřejný web, administraci a časomíru na designový systém „Modrá stopa“ podle 115 artboardů v `design_modra_stopa/` (lokální, mimo git). Vývoj a ověřování probíhá na testovací replice podm12.com; produkce jmlp.cz se nemění, dokud redesign neschválíš.

**Architecture:** **Bootstrap a Bootstrap Icons z aplikace úplně mizí** — žádná kopie v repu, žádný shim s jeho třídami, žádné `--bs-*`. Nové UI = tokeny `--ms-*` + CSS Modules + malý kit v `components/ms/` (primitiva, pět rozvrhových komponent jen s `gap`, `Icon`). Staré CSS (Bootstrap z CDN, `assets/styles/*`, inline `<style>`) jde v prvním nasazení do `@layer legacy`, takže nové styly nad ním vždy vyhrají, a obrazovky se převádějí jedna po druhé. Bootstrap Icons zmizí hned po Fázi 1, Bootstrap CSS spolu se vším starým CSS v jednom commitu ve Fázi 6. Návratu Bootstrapu brání test `check:styles`. Podrobnosti: **[příloha — odchod od Bootstrapu](2026-09-30-redesign-modra-stopa-bootstrap.md)**.

**Tech Stack:** React 18 + Vite 5, CSS Modules (vestavěné ve Vite), bez UI a utility frameworku. Nově: `@fontsource/archivo`, `@fontsource/source-sans-3`, `@fontsource/ibm-plex-mono` (self-hosted kvůli offline časomíře), ikony jako vložené stroke SVG (zdroj viz otevřené otázky). Testy: Vitest + Testing Library.

**Podklady:**
- `design_modra_stopa/BRIEF.md` — tokeny, písma, signaturní prvky (závazné)
- `design_modra_stopa/KANON.md` — kanonická data v artboardech (ne v aplikaci)
- `design_modra_stopa/INVENTAR.md` — všechny pohledy, stavy, modaly a formuláře, které aplikace umí; žádný nesmí redesignem zmizet
- `design_modra_stopa/STAV.md` — rozhodnutí a otevřené otázky
- `design_modra_stopa/project/*.dc.html` — artboardy (desktop 1600 / mobil 390)

---

## 0. Pracovní režim na podm12.com

- Redesign žije ve větvi **`redesign/modra-stopa`** v `/opt/jmlp_web_v1`. `main` zůstává shodný s produkcí.
- **Pozor na synchronizaci kódu:** `git reset --hard prod/main` by redesign smazal. Během redesignu se kód z produkce přebírá jen `git fetch prod && git rebase prod/main` ve větvi redesignu.
- Synchronizace dat (`~/jmlp-sync/sync-data-from-prod.sh`) je bezpečná kdykoli — redesign nemění schéma, kromě bodů označených **[backend]**.
- Nasazení na podm12.com po každé dokončené obrazovce: `docker compose build frontend && docker compose up -d --no-deps frontend` (backend se při změně `backend/app` restartuje `docker compose restart backend`).
- Při každé změně favicon/manifestu/ikon zvednout `CACHE_NAME` v `frontend/public/sw.js`.
- Kontrola každé obrazovky: `npm test`, `npm run build`, vizuální porovnání s artboardem na 1600 px a 390 px (Chrome), klávesnice + kontrast (BRIEF: dotykový cíl ≥ 44 px, barvy jen z tokenů).

## Výchozí stav (zmapováno 2026-09-30)

- Bootstrap 5.3 CSS + Bootstrap Icons z CDN (`src/assets/styles/main.css:4,28`), žádný react-bootstrap.
- Primární barva definovaná na třech místech proti sobě: `index.html` (inline `<style>`), `variables.css`, `main.css`.
- Veřejný web: tmavé „sunset glassmorphism“ téma (`base.css`, `variables.css`) s fotkou na pozadí.
- Administrace + časomíra: světlé téma `body.theme-backoffice` v `admin.css` (880 ř., `--adm-*`, `--tk-*`).
- ~475 inline `style={{…}}` (časomíra 274, veřejné stránky 111), inline `<style>` v 6 komponentách.
- Modaly vlastní (`.modal` markup + stav), `ConfirmDialog`/`useConfirm` v 13 souborech.
- Žádná písma se nenačítají (systémový font).
- Testy nekontrolují CSS třídy; na text/role se odkazuje 45 dotazů, `src/test/navigation.test.js` hlídá menu vs. routy.
- PDF (`src/pdf/`, pdfmake) na CSS nezávisí — rebranding PDF je samostatné rozhodnutí.

---

## Fáze 1 — Základ designového systému

> Před první odrážkou provést nasazení **D0 „staré CSS do vrstvy“** a po fázi nasazení **„Ikony“** — obojí včetně kitu, pojistky `check:styles`, kanárkového buildu bez starého CSS a úprav `Modal`/`useConfirm` je rozepsané v příloze, oddíl „Úpravy fází“. Odrážky níže platí s těmito doplňky; kde se liší (CSS Modules místo globálních tříd, `lucide-react`), platí příloha.

**Files:**
- Create: `frontend/src/styles/ms/tokens.css` — tokeny z BRIEF.md jako CSS proměnné `--ms-*`
- Create: `frontend/src/styles/ms/base.css` — písma, typografická škála, `.ms-scope` reset
- Create: `frontend/src/components/ms/` — primitiva (níže)
- Create: `frontend/src/components/ms/Icon.jsx` — tenký wrapper nad `lucide-react` (stroke 1.75, `aria-hidden`)
- Modify: `frontend/src/main.jsx` — import písem a `styles/ms/*`
- Modify: `frontend/package.json`

- [ ] Založit větev `redesign/modra-stopa`, commitnout `.gitignore` (`design_modra_stopa/`).
- [ ] Ověřit vizuálně, že `src/assets/images/jmlp_logo.png`, `background.jpg`, `czech_ski_snowboard-logo.png` odpovídají třem `/_blob/` obrázkům z BRIEF; chybějící vyexportovat z artefaktu.
- [ ] Přidat `@fontsource/*` (jen použité řezy: Archivo 500–800, Source Sans 3 400/600/700, IBM Plex Mono 500/600) a `lucide-react`.
- [ ] `tokens.css`: všechny barvy z BRIEF, nic navíc; komentář s kontrastním poměrem u každé textové dvojice.
- [ ] Primitiva, každé s testem renderu a přístupného jména:
  - `Button` (primary / outline / danger, výška 44–48, `ButtonSpinner`)
  - `Badge` (open, closed, live, count-amber, admin varianta)
  - `Paska` — nadpis sekce + 2px linka (40 px navy)
  - `BibDate` — zkratka dne / číslo dne v Plex Mono / měsíc+rok (varianta `compact` pro admin)
  - `DataRow` — 4px stavová lišta, číselný box, dva řádky, pravé tabulkové číslo
  - `PageHeader` — eyebrow + H1
  - `Field` — `<label for>` + input/select/textarea + chyba v `--ms-live-ink`
  - `Modal` — `<dialog>`/focus trap, zavření Esc, zámek scrollu; `ConfirmDialog` přepsat na něj beze změny API `useConfirm`
  - `EmptyState`, `LoadingState`, `Alert` — přestylovat se zachováním API
  - `LivePill` (ŽIVĚ / klid)
  - `Tabs` (časomíra)
- [ ] Dev-only stránka `/__ms` (jen `import.meta.env.DEV`) s katalogem primitiv pro rychlou vizuální kontrolu.
- [ ] `npm test && npm run build`, commit.

## Fáze 2 — Rámec veřejného webu

Artboardy: `Zavody.dc.html` (hlavička/patička — kopírovat doslova), `Main.dc.html` (velká patička), `MobilMenu`, `NotFound`, `Mobil404`, `DialogPotvrzeni`, `DialogUpozorneni`.

- [ ] Přepsat `components/layouts/Navigation.jsx`: 6 položek (Úvod · Závody · Výsledky · Aktuality · Dokumenty · Kontakty) + `LivePill` vpravo, vždy viditelný; mobilní menu.
- [ ] Přepsat patičku v `components/layouts/Layout.jsx` (`© 2006–2026`, odkaz Ochrana osobních údajů, odstranit zástupné telefonní číslo).
- [ ] Veřejné stránky obalit `.ms-scope`; odstranit fotku na pozadí a glass efekt pro veřejný web.
- [ ] Routy + přesměrování v `Router.jsx`: `/aktuality` (← `/archiv-zprav`), `/zive` (← `/livetiming`), `/registrace` → `/zavody`, nová `/vysledky` (zatím prázdný stav).
- [ ] NotFound jako samostatná komponenta dle artboardu; nginx (`frontend/nginx.conf`) vrací pro neznámé cesty skutečný stav 404 — ověřit, že to nerozbije SPA routy.
- [ ] Upravit `navigation.test.js` a testy odkazující na staré URL.

## Fáze 3 — Veřejné stránky

Pořadí podle návštěvnosti a rizika. Každá položka = samostatný commit + nasazení na podm12.com + kontrola desktop/mobil.

- [ ] **Závody** `/zavody` — `Zavody`, `MobilZavody`: výběr sezóny jako `<select>`, filtr Vše / Na sněhu / Suché (`race_method_id` 1 = sníh, 2 = suché; bez backendu), `DataRow` se stavem registrace, na < 768 px řádky místo tabulky.
- [ ] **Detail závodu + přihláška** `/zavod/:id` — `ZavodDetail`, `ZavodDetailOdjeto`, `ZavodDetailUzavreno`, `Mobil*`, `PrihlaskaHledani`, `PrihlaskaChyby`, `PrihlaskaOdeslana`, `DialogVyberKlubu`, `MobilRegistrace`. Zachovat všechny stavy z INVENTAR („Registrace na závod“, „Registrační formulář“, „Nalezení závodníci“). Po odjetí závodu seznam přihlášených nezveřejňovat.
- [ ] **Úvod** `/` — `Main`, `MobilUvod`: hero s fotkou a navy přechodem, nejbližší závod, sezóna, aktuality. Z `Homepage.jsx` odstranit inline `<style>`.
- [ ] **Aktuality** `/aktuality` — `AktualityArchiv`, `AktualityArchivPrazdne`, `MobilAktuality`: rozlišit prázdný / chybový / načítací stav (dnes jeden).
- [ ] **Dokumenty**, **Kontakty** — restyle.
- [ ] **Živě** `/zive` — `Zive`, `ZiveKlid`, `Mobil*`: nový klidový stav místo přesměrování na `/`; `ResultsTable` sdílený s časomírou přestylovat tak, aby fungoval v obou.
- [ ] **Výsledky** `/vysledky` — `Vysledky`, `MobilVysledky`. **[backend]** `GET /season-results/{rok}/standings` nad `services/results.py` (`rank_category`, `points_for_rank`), pytest v `backend/app/tests/`. Pro sezónu 2026/27 poctivý prázdný stav.

## Fáze 4 — Administrace

Rámec: `AdminMobilMenu` + postranní panel 256 px `--ms-navy-deep`. Pořadí menu: Přehled, Závody, Závodníci, Žádosti o kluby (počet), Dokumenty, Aktuality | Sezóny, Kluby, Kategorie, Účty správců.

- [ ] `AdminLayout.jsx` + `AdminLogin` + catch-all `*` (`AdminNeznama`).
- [ ] Přehled (`AdminDashboard`, `AdminPrehledChyba`, `AdminMobilPrehled`) — včetně opravy pádu po zavření chyby (`AdminDashboard.jsx:39-49`); `VisitsChart` barvy z tokenů.
- [ ] Závody + formulář + přihlášky (`AdminZavody`, `AdminZavodForm`, `AdminPrihlasky`, mobilní varianty).
- [ ] Závodníci + formulář (`AdminZavodnici`, `AdminZavodnikForm`).
- [ ] Žádosti o kluby, Kluby.
- [ ] Dokumenty, Přílohy (`AttachmentManager`, `LibraryPicker`).
- [ ] Aktuality + formulář příspěvku.
- [ ] Sezóny, Kategorie (včetně `CoverageReport`, `RecalculateSummary`).
- [ ] Účty správců (`AdminUcty`) — viz otevřené otázky.
- [ ] 26 dialogů `AdminDialog*` postupně s jejich obrazovkou; seznam k odškrtání je `MODALY.md`.
- [ ] Po převedení poslední obrazovky: `body.theme-backoffice` a `--adm-*` v `admin.css` pro admin nepoužívané.

## Fáze 5 — Časomíra

Časomíra se používá v závodní den offline — nasazovat ji **ne v týdnu před závodem** a ověřit offline režim.

- [ ] Rámec: horní lišta 76 px, stavové čipy Spojení / Fronta / Zařízení, lišta tabů v novém pořadí (Přehled · Detail závodu · Závodníci · Startovní listina · Zadávání časů · Výsledky | Čísla · Synchronizace · Zařízení), mobilní menu. Z `TimekeeperLayout.jsx` odstranit inline `<style>`, `TimekeeperChrome.jsx` na tokeny.
- [ ] `TkLogin`, `TkVyberZavodu`, `TkPrehled` (přehled jednoho závodu — částečně nový obsah ze stávajících dat).
- [ ] Detail závodu, Závodníci, Startovní listina, Zadávání časů, Výsledky, Čísla, Synchronizace, Zařízení (+ `TkMobil*`).
- [ ] 12 dialogů `TkDialog*`.
- [ ] Ověřit offline: písma a ikony jsou v `/assets/` (cache-first v SW), žádná CDN závislost; `src/test/screens.test.jsx` projde.
- [ ] Barvy sad startovních čísel (`src/utils/raceNumbers.js`) ponechat — jsou to skutečné barvy dresů, ne téma.

## Fáze 6 — Úklid

- [ ] Odebrat Bootstrap CSS a Bootstrap Icons z `main.css`, inline `<style>` z `index.html`, `variables.css`, `base.css`, zbytek `admin.css`, nepoužité třídy v `components.css`/`pages.css`/`utilities.css`.
- [ ] `grep -rn "className=\"[^\"]*\b(btn|col-|row|d-flex|card|table)\b"` → 0 výskytů; počet `style={{` výrazně dolů (cíl: jen dynamické hodnoty).
- [ ] Upravit test `serviceWorker.test.js:168` (odkazuje na CDN Bootstrap).
- [ ] Zvednout `CACHE_NAME` v `sw.js`.
- [ ] Lighthouse/axe kontrola hlavních stránek (kontrast, názvy tlačítek, cíle ≥ 44 px).

## Fáze 7 — Nasazení na produkci

- [ ] Tvoje schválení na podm12.com (desktop + mobil, všechny tři sekce).
- [ ] Rebase na `prod/main`, přenést větev na produkci (`/opt/jmlp`), build, `docker compose -f docker-compose.server.yml up -d`.
- [ ] Mimo závodní víkend; plán návratu = předchozí image / `git reset` na předchozí commit.

---

## Mimo redesign — udělat hned, na produkci

- **Časomíra — konflikt revize může přepsat cizí čas Enterem** (ověřeno v kódu 2026-09-30): `ConfirmDialog` po otevření zaměří první volbu (`components/ui/ConfirmDialog.jsx:28`) a v dialogu konfliktu je první „Přepsat mojí hodnotou“ (`components/timekeeper/useTimeSaving.jsx:172`). Enter při rychlém zápisu časů tak přepíše hodnotu, kterou mezitím uložilo jiné zařízení. Oprava: bezpečnou volbu „Ponechat hodnotu ze serveru“ dát jako první. Nasadit mimo závodní den.
- **Bezpečnost — nepublikované příspěvky jsou veřejně čitelné** (`backend/app/routers/posts.py`):
  - `GET /posts/?published_only=false` je veřejný endpoint a vrátí i nepublikované příspěvky (ověřeno na jmlp.cz 2026-09-30: 8 místo 6, tj. 2 koncepty). Parametr odstranit — frontend ho nikde nepoužívá, admin má vlastní endpoint.
  - `/posts/{id}/document/download` a `/posts/{id}/image` nekontrolují `published` — příloha konceptu je stažitelná podle ID.
  - Malá backendová oprava, nezávislá na designu.
- **Pád přehledu administrace** (`AdminDashboard.jsx:39-49`) — lze opravit hned, nečekat na fázi 4.

## Otevřené otázky (potřebují rozhodnutí před příslušnou fází)

1. **Uzávěrka registrace** (fáze 3): artboardy ukazují „uzávěrka st 30. 9. ve 20:00“ a odpočet. `fuj_jmlp_race` nemá sloupec pro uzávěrku (jen `registration`, `closed`). Buď nový sloupec + pole v administraci **[backend]**, nebo uzávěrku z UI vypustit. STAV.md povoluje jen jeden nový endpoint — sloupec je výjimka z pravidla.
2. **Účty správců** (fáze 4): seznam účtů nemá endpoint (jen `POST /register`, `GET /me`) **[backend]**; role v návrhu („Člen výboru“, „Komisař soutěže“) neodpovídají DB (`admin`, `timekeeper`).
3. **„Aktuality k závodu“ v detailu závodu**: příspěvek nemá vazbu na závod. Vynechat, heuristika podle data, nebo **[backend]** vazba.
4. **Zrcadlová kategorie** (`AdminDialogZrcadlovaKategorie`, „nad rámec dnešního kódu“): implementovat, nebo vynechat.
5. **Komisař na stránce Kontakty** a **URL `/aktuality`** — otevřené v STAV.md.
6. **Stránka Ochrana osobních údajů** — nemá artboard ani text; kdo dodá obsah?
7. **PDF** (startovky, výsledky): přebarvit na Modrou stopu, nebo nechat.
8. **Ikony** (nasazení „Ikony“ po Fázi 1): `lucide-react` (rychlé, mírně jiný vzhled), nebo cesty SVG ručně převzaté z artboardů (tah 1,8–3, nejčastěji 2–2,2 — přesná shoda s návrhem, víc práce)?
9. **Pořadí fází:** audit doporučuje časomíru (Fáze 5) před administrací (Fáze 4), aby nejrizikovější sekce měla nejdelší zkoušení na podm12.com. Nic jiného na tom nezávisí.
