# Redesign „Modrá stopa“ — odchod od Bootstrapu

> Příloha k [2026-09-30-redesign-modra-stopa.md](2026-09-30-redesign-modra-stopa.md). Vzniklo z auditu 2026-09-30: 89 souborů přečtených celých (8 čtenářů + CSS/infra), nezávislá mechanická kontrola úplnosti proti úplnému slovníku Bootstrapu 5.3.0 a Bootstrap Icons 1.10.0, tři nezávislé strategie a dva hodnotitelé (vyhrála „architecture-first“, doplněná o nápady z ostatních). Čísla řádků platí pro commit `00042db`.

**Rozsah:** 284 různých tříd Bootstrapu, 131 ikon (~400 výskytů v 69 souborech), 597 míst funkční závislosti (+13 z kontroly úplnosti), 475 inline stylů, 6 JSX `<style>`, 7 z 8 CSS souborů závislých na Bootstrapu (320 selektorů).

Doplnění k fázím 1–6. Mění je podle oddílu „Úpravy fází“. Cesty jsou v `frontend/src/` a jména souborů jsou tam jednoznačná.

## Strategie

- **Cíl:** po Fázi 6 v `frontend/` nic nezávisí na Bootstrapu ani na Bootstrap Icons. Nezůstane CDN import ani kopie v repu. Třídy Bootstrapu nepřežijí pod původním ani pod novým jménem (žádný shim) a nezůstanou ani proměnné `--bs-*`.
- **Architektura stylů:**
  - tokeny `--ms-*` (jen z BRIEF),
  - CSS Modules (`*.module.css` vedle komponenty, hashované třídy),
  - malý kit v `components/ms/`: primitiva, pět rozvrhových komponent (`Container`/`Stack`/`Cluster`/`Grid`/`Split`), které znají jen `gap`, a `Icon`.
  - Žádný utility framework ani globální slovník tříd. Globální jsou jen `.ms-scope` (kořen nového UI) a `.ms-sr-only`.
- **Soužití starého a nového CSS:**
  - Nasazení D0 přesune veškeré staré CSS do jedné vrstvy `@layer legacy`. Pořadí zůstane stejné jako dnes: inline blok z `index.html` → Bootstrap → Icons → partialy → přepisy v `main.css` → JSX `<style>`.
  - Nové CSS je mimo vrstvu, takže vyhraje nad starým bez ohledu na specificitu. Hashované třídy se se starými nepotkají.
  - Staré elementové styly (`h1–h6`, `li`, `*:focus`, bílý `body`) mohou prosakovat do nového UI. To neutralizuje reset v `:where(.ms-scope)`.
  - Nepřevedené stránky běží v nových rámcích uvnitř `LegacyIsland`, který zachová staré obaly.
  - Sdílené komponenty se rozdělí na kopii pro každou sekci a mažou se s posledním uživatelem.
- **Kdy zmizí CDN importy:**
  - Bootstrap Icons (`main.css:28`) v samostatném nasazení „Ikony“ hned po Fázi 1.
  - Bootstrap CSS (`main.css:4`) v jednom commitu ve Fázi 6, spolu s veškerým starým CSS. Podmínky: `check:styles --final` hlásí nulu a kanárkový build bez starého CSS potvrdí všechny obrazovky.
  - Bootstrap se do repa nekopíruje. Do Fáze 6 zůstává na CDN jen kvůli nepřevedeným obrazovkám na podm12.com.
- **Pojistky proti novému použití Bootstrapu:**
  1. `scripts/check-styles.mjs` běží jako Vitest test. Hlídá strop počtu tříd Bootstrapu, `bi-`, `--bs-`, starých proměnných a emoji pro každý soubor. Počty smí jen klesat a převedené soubory musí mít nulu.
  2. Kanárkový build `JMLP_NO_LEGACY=1`.
  3. Pravidla kitu: žádné `!important`, hexy ani globální třídy; breakpointy jen 768/1024/1280.
  4. Sekce „Modrá stopa UI“ v `CLAUDE.md` pro agenty.

## Náhrady

| Bootstrap | Modrá stopa |
|---|---|
| Reboot (okraje, dědění písma v ovládacích prvcích, `th`, `border-collapse`, `[hidden]`) | `styles/ms/base.css`: reset v `:where(.ms-scope)`; globálně `box-sizing`, `[hidden]{display:none!important}`, reduced-motion |
| Grid: `container(-fluid)`, `row`, `col-*`, `g-*`, `row-cols-*`, `order-*` | `Container` (1240 px, okraj 16 px na 390 px), `Grid` (`min` / `columns`), `Split` (poměr, `stackBelow`, `reverse` místo `order-*`) |
| Flex a mezery: `d-flex`, `flex-*`, `justify-*`/`align-*`, `gap-*`, `m*`/`p*`, `w-100`, `h-100`, `vh-100` | `Stack`, `Cluster` (jen `gap` z `--ms-space-*`), padding jen v modulu komponenty, `min-block-size:100dvh` |
| Typografie a barvy: `text-*`, `bg-*`, `*-subtle`, `fw-*`, `fs-*`, `display-1`, `small`, `border*`, `rounded*`, `shadow*`, `opacity-*`, `bg-pink` | Role písma v modulech (`PageHeader`, `Paska`), barvy jen přes `var(--ms-*)`, stín jen u dialogu, význam nese text (`Badge`, `ResultStatus`) |
| Tlačítka: `btn`, `btn-*`, `btn-outline-*`, `btn-link`, `btn-sm`/`btn-lg`, `<a class="btn">`, `<label class="btn">` | `Button` (primary / outline / danger / quiet, ≥ 44 px, `busy`), `ButtonLink` (router), `IconButton` (povinný `label`), `FileButton` |
| Výběr vyjádřený barvou: `btn-group`, `btn-primary`↔`btn-outline-*`, `.active` | `SegmentedControl` (`role=group`, `aria-pressed` nebo radio); DNF/DNS/DSQ jako `aria-pressed`; sezóna jako `<select>` |
| `btn-close` | `CloseButton label="Zavřít …"` (44×44) |
| Karty: `card*`, `card-img-top`, `h-100` | `Panel` + `Paska`; výpisy jako `DataRow`; bez `transform` při hoveru |
| Odznaky: `badge` + `bg-*`, `rounded-pill`, `getRaceNumberBadgeStyle`, `getExtensionBadgeClass` | `Badge tone` (vždy s textem), `BibChip` (`--ms-bib-*`), `ResultStatus`, `FileTypeBadge` (helper vrací klíč tónu) |
| Alerty: `alert-*`, `alert-dismissible`, `alert-heading`, `fade`/`show` | `Alert`: tón; chyba má `role=alert`, ostatní `status`; úspěch po 3 s zmizí a odmontuje se; kontrakt `{type,text}` |
| Tabulky: `table*`, `table-light`/`-dark`/`-danger`, `align-middle`, `sticky-top` | `Table`: šířka 100 %, `th` vlevo, čísla v Plex Mono, `stickyHeader`; stav řádku přes `data-state` + 4px lištu + text |
| `table-responsive` | `TableScroll`: `overflow-x:auto` v každé šířce, `role=region`, `tabIndex=0`; pod 768 px `DataRow`, kde to chce artboard |
| Formuláře: `form-label`, `form-control(-sm/-lg)`, `form-select(-sm)`, `form-text` | `Field` (`useId`, `htmlFor`, `aria-describedby`), nativní `Input`/`Select` (šipka jako `Icon`)/`Textarea` |
| Validace: `is-invalid`, `invalid-feedback`, `d-block` | `Field error`: vykreslí se jen při chybě, `aria-invalid`, text a ikona v `--ms-live-ink` |
| `form-check*`, `form-switch` | `Checkbox`, `Switch` (`role=switch`, viditelný popisek, `e.target.checked` beze změny) |
| `input-group`, `input-group-text` | `InputAffix` |
| `navbar*`, `collapse` + `show`, `nav`, `nav-pills`, `nav-link.active` | `SiteHeader` + `MobileMenu` (`Modal`), `AdminSidebar` + zásuvka, lišta časomíry; `NavLink` + `aria-current`; položky z `navItems.js` |
| `modal*`, `modal-backdrop`, `fade show d-block` | `Modal` na `<dialog>.showModal()`; `ConfirmDialog`/`useConfirm` nad ním |
| `spinner-border(-sm)` | `Spinner` (vlastní `@keyframes`, při reduced-motion stojí), `LoadingState` (`role=status`, jeden text), `Button busy` |
| `visually-hidden` | `VisuallyHidden` / `.ms-sr-only` (varianta `focusable`) |
| `list-group*`, `list-group-item-action` | `List`/`ListRow as="a\|button"` (44 px, hover a `:focus-visible`), `OptionList` (listbox, počet v `aria-live`) |
| `pagination`, `page-item`, `page-link`, `active` | `Pagination`: `nav aria-label="Stránkování"`, `aria-current`, pojmenované tlačítko předchozí/další |
| `progress`, `progress-bar` | `ProgressBar`: `role=progressbar`, `aria-value*`, text vedle pruhu |
| Viditelnost a pozice: `d-none`, `d-*-*`, `float-*`, `position-*`, `sticky-top`, `img-fluid`, `text-truncate`, `text-nowrap`, `text-md-end` | Media queries v modulu (768/1024/1280); `useMediaQuery` jen při výměně struktury; `Truncate` (plný text v `title`); obrázek v gridu místo `float` |
| Našeptávač z `form-control` + `position-absolute` (`SearchableSelect`, `RaceForm`) | `Combobox` (ARIA 1.2, šipky/Enter/Escape, bez portálu); výběr klubu v `Modal` |
| Dropzóna z utilit (`border`, `border-primary bg-primary-subtle`, input s `d-none`) | `Dropzone` + `FileButton` (skrytý, ale fokusovatelný input) |
| Bootstrap Icons `bi-*` (131 názvů, i jako props) | `Icon name` (lucide-react, `aria-hidden`); ikonová tlačítka jako `IconButton label`; stavové ikony doplněné textem |
| `--bs-*` a staré tokeny v JSX (`--text-primary`, `--sunset-orange`, `--glass-bg`, `--tk-*`, `--adm-*`, `TK_ACCENT*`, `#0d6efd`, `#e94560` …) | Jen `--ms-*`, pro sady dresů `--ms-bib-*`, pro Chart.js `tokens.js` |
| Stavové třídy `fade`/`show`/`active`, `@keyframes livePulse` v `<style>` | React stav + `aria-*`/`data-*`; `LivePill` s vlastní animací |

## Funkční závislosti

Všechno níže musí mít náhradu dřív, než ve Fázi 6 zmizí Bootstrap. Zdroj: audit 2026-09-30 (597 míst) a kontrola úplnosti (13 míst navíc). Položka se odškrtává s převedením obrazovky. Hotovost ověřuje `check:styles` a kanárek.

**1. Načítání stylů**
- [ ] Vstupy: `main.jsx:4` (duplicitní `App.jsx:2` smazat v D0), CDN `main.css:4` (Bootstrap) a `main.css:28` (Icons), blok `index.html:17-125`, `index.html:2` (chybí `lang`).

**2. Modaly, potvrzení, překryvy** → `Modal`, `ConfirmDialog`/`useConfirm`
- [ ] Sdílený dialog `ConfirmDialog.jsx`:
  - `:28` fokus jde na první (často nebezpečnou) volbu, chybí past fokusu i jeho návrat;
  - `:47` backdrop, vrstvení 1050/1055 proti `.navbar` 1030 a `SearchableSelect` 9999;
  - `:49`, `:53` (klik mimo), `:55`, `:56`;
  - API ve tvaru Bootstrapu v `useConfirm.jsx:40`.
- [ ] Volající, kteří se bez Bootstrapu vykreslí v toku stránky:
  - administrace: `RacerManagement.jsx:566`, `DocumentLibrary.jsx:433`, `CategoryManagement.jsx:413`, `SeasonManagement.jsx:108`, `ClubManagement.jsx:212`, `RaceManagement.jsx:65`, `AttachmentManager.jsx:143`;
  - `ClubDeleteDialog.jsx:72,80`: první volba je zakázaná, fokus zůstane za dialogem;
  - časomíra: `StartListManager.jsx:645`, `TimingEntry.jsx:490`, `ConflictDialogMessage.jsx:16`, `ResultsView.jsx:149`;
  - `useTimeSaving.jsx:169`: Enter potvrdí „Přepsat mojí hodnotou“;
  - `useInboxEvents.js:466,484,504`: `variant` `warning`/`danger` + `bi-*`.
- [ ] Vlastní modaly:
  - `RacerManagement.jsx:442,443,565`, `SeasonManagement.jsx:242`;
  - `RaceForm.jsx:32,33`, vnořené `:179`;
  - `PostForm.jsx:29,30`, vnořené `:102`, `PostManagement.jsx:33`;
  - `LibraryPicker.jsx:35,60,61,62`;
  - `PdfPreviewModal.jsx:33,34,35,36,54`: iframe 90vh drží jen flex řetězec;
  - náhled a potvrzení nad sebou: `ResultsView.jsx:353,364`, `StartListManager.jsx:634`, `TimingEntry.jsx:479`.
- [ ] Nativní dialogy a chybějící potvrzení:
  - `window.confirm` v `useRaceManagement.js:261`, `usePostManagement.js:196`, `RaceNumbersManager.jsx:127`;
  - `alert()` v `ClubRequests.jsx:52`;
  - Force/Drop bez potvrzení v `SyncCenter.jsx:320`;
  - formulář kategorie se mění na dialog v `CategoryManagement.jsx:394`.

**3. Zavírací tlačítka** → `CloseButton`, `Alert onDismiss`
- [ ] Křížek existuje jen jako obrázek Bootstrapu; bez něj je tlačítko prázdné a často bez jména:
  - přes `Alert.jsx:65`: `RacerManagement.jsx:292`, `DocumentLibrary.jsx:232`, `CategoryManagement.jsx:359`, `SeasonManagement.jsx:144`, `AdminLogin.jsx:37`, `RaceFilters.jsx:40`, `RaceRegistrations.jsx:61`, `PostFilters.jsx:24`, `PostForm.jsx:47`, `AttachmentManager.jsx:176`, `TimekeeperLogin.jsx:49`;
  - přes `TimekeeperChrome.jsx:58`: `TimekeeperRacers.jsx:473`, `StartListManager.jsx:488`, `TimingToolbar.jsx:237`, `RaceHeaderForm.jsx:131`, `SyncCenter.jsx:217`;
  - přímo: `ConfirmDialog.jsx:61`, `RaceDetail.jsx:195`, `Registration.jsx:135`, `RegistrationMessage.jsx:17`, `RacerManagement.jsx:449`, `SeasonManagement.jsx:251`, `RaceForm.jsx:40`, `PostForm.jsx:36`, `LibraryPicker.jsx:66`, `PdfPreviewModal.jsx:41`, `RaceNumbersManager.jsx:242`, `ResultsView.jsx:303`;
  - ikonové zavření: `CoverageReport.jsx:20`, `RecalculateSummary.jsx:20`.
- [ ] `AdminDashboard.jsx:47`: zavření chyby při `data === null` shodí přehled (oprava viz „Mimo redesign“).

**4. Ikony nesoucí obsah** → `Icon`, `IconButton label`, text
- [ ] Tlačítka a odkazy jen s ikonou (bez fontu jsou prázdná):
  - administrace: `RacerManagement.jsx:49,56`, `DocumentLibrary.jsx:398,403,406,414,422`, `CategoryTable.jsx:89-117` (pauza/aktivní rozlišená jen ikonou na 105-109), `SeasonManagement.jsx:196,204,208` (ikony 202,205,215; tlačítko 204 nemá jméno), `ClubManagement.jsx:183`, `RaceTable.jsx:102`, `PostTable.jsx:99`, `AttachmentList.jsx:107`, `AttachmentSlot.jsx:110`;
  - časomíra: `TimekeeperRacers.jsx:751`, `TimekeeperRacerRow.jsx:36`, `StartListManager.jsx:452` (jediné řazení kategorií z klávesnice), `StartListManager.jsx:595`, `StartListRow.jsx:41`, `RaceNumbersManager.jsx:334,390`, `TimingDeviceSettings.jsx:213`, `TimekeeperLayout.jsx:305` (odhlášení pod 1280 px);
  - `Layout.jsx:45-50`.
- [ ] Stav vyjádřený jen ikonou: `ResultsTable.jsx:199`, `SeasonManagement.jsx:190`, `ClubManagement.jsx:170`, `TimingTable.jsx:47`, `RaceHeaderForm.jsx:159`.
- [ ] Ikona jako prop nebo data:
  - `EmptyState.jsx:12` a jeho volání `Documents.jsx:110`, `PostsList.jsx:6`, `LibraryPicker.jsx:82`, `TimekeeperRacers.jsx:674`, `TimingEntry.jsx:475`;
  - `ConfirmDialog.jsx:83`, `useTimeSaving.jsx:173`;
  - `Navigation.jsx:79` (bez třídy `bi`).
- [ ] Dekorativní (bez náhrady zůstanou prázdné boxy):
  - veřejný web: `Contacts.jsx:48,71,92,96,125,148`, `RaceCalendar.jsx:119`, `RacerSearchResults.jsx:11,26,55`;
  - administrace: `RaceManagement.jsx:19`, `RaceFilters.jsx:33`, `RaceTable.jsx:45`, `RaceRegistrations.jsx:109,118,127,136`, `PostTable.jsx:31`, `AttachmentList.jsx:146`, `AdminLayout.jsx:49,59,72,134`, `AdminDashboard.jsx:104,120,137,153,171,192`, `VisitsChart.jsx:188`;
  - časomíra: `TimekeeperLayout.jsx:162,191-269,287`, `TimekeeperLogin.jsx:40`.

**5. Načítání** → `Spinner`, `LoadingState`, `Button busy`, `VisuallyHidden`
- [ ] `LoadingState.jsx:16,17,18,55`: spinner neviditelný, skrytý popisek viditelný, fullscreen necentrovaný, `role=status` spolu s `aria-hidden`. Jediné pravidlo pro spinner v projektu je `main.css:148`.
- [ ] Přes `LoadingState`/`ButtonSpinner`:
  - vstupy a veřejný web: `Router.jsx:50,59`, `AdminRoutes.jsx:25`, `TimekeeperRoutes.jsx:24`, `Documents.jsx:93`, `NewsArchive.jsx:13`, `RegisteredRacersCard.jsx:35`;
  - administrace: `RacerManagement.jsx:268`, `DocumentLibrary.jsx:226,315`, `CategoryManagement.jsx:263,266,288,309,311,329`, `SeasonManagement.jsx:154,313`, `AttachmentList.jsx:143`, `AttachmentManager.jsx:185`, `AttachmentSlot.jsx:130`;
  - časomíra: `TimekeeperRacers.jsx:574,671` (671 je mrtvá větev), `StartListManager.jsx:367,416,490`, `TimingEntry.jsx:426`, `RaceHeaderForm.jsx:140,263`, `ResultsPrintButtons.jsx:35`.
- [ ] Vlastní spinnery:
  - veřejný web: `Homepage.jsx:70`, `LiveTiming.jsx:68` (bez spinneru prázdná stránka), `RaceCalendar.jsx:76`, `RaceDetail.jsx:55`, `Registration.jsx:65`, `RacerSearchResults.jsx:17`;
  - administrace: `AdminLogin.jsx:84`, `AdminDashboard.jsx:37`, `VisitsChart.jsx:178`, `AdminRegister.jsx:236`, `ClubRequests.jsx:64`, `RaceForm.jsx:245`, `RaceRegistrations.jsx:52`, `PostManagement.jsx:25`, `PostTable.jsx:12`;
  - časomíra: `RaceNumbersManager.jsx:211,304,400`, `TimekeeperLogin.jsx:108`, `TimekeeperDashboard.jsx:57`, `ResultsView.jsx:310` (bez spinneru prázdná obrazovka).

**6. Navigace a responzivní viditelnost** → `SiteHeader`/`MobileMenu`, `AdminSidebar`, lišta časomíry, `NavLink aria-current`
- [ ] Mobilní menu skrývá jen `.collapse:not(.show)`:
  - `Navigation.jsx:61`;
  - `:35` expand-lg a sticky `.navbar` z `layout.css:4-11` se z-indexem 1030;
  - `:57` toggler bez obrázku a s anglickým popiskem;
  - `:62`;
  - `:67` aktivní položka bez `aria-current`.
- [ ] Třídy `d-*` po odchodu Bootstrapu spadnou na `utilities.css:114-130` s jinými breakpointy: `Navigation.jsx:45,46` (plný název by se nikdy neukázal, „JMLP“ by byl na desktopu), `AdminDashboard.jsx:212,264`.
- [ ] Aktivní položku postranního menu nese jen pilulka `.active`: `AdminLayout.jsx:70` (`admin.css:279`), `TimekeeperLayout.jsx:185`. Administrace nemá mobilní variantu: `AdminLayout.jsx:37`.

**7. Rozvržení** → `Container`/`Stack`/`Cluster`/`Grid`/`Split`, `LegacyIsland`
- [ ] Obaly stránek a rámce:
  - veřejný web: `Router.jsx:38`, `Layout.jsx:5,14,19,20,30,31-34,36-44`, `Homepage.jsx:128,129`, `NewsArchive.jsx:12`;
  - administrace: `AdminLayout.jsx:33,36` (bez `bg-dark` jsou bílé odkazy na světlém pozadí), `AdminLayout.jsx:157,159`, `RaceManagement.jsx:14`;
  - časomíra: `TimekeeperLayout.jsx:60,147,184,276,312,314`;
  - přihlášení: `AdminLogin.jsx:28`, `TimekeeperLogin.jsx:29,30,31`.
- [ ] Sloupce (bez gridu se vše složí pod sebe):
  - veřejný web: `Contacts.jsx:53,55,56,109,110`, `NewsFilters.jsx:19`, `RaceDetail.jsx:110,111,140`, `RegistrationForm.jsx:35,37,78` (výsledky hledání by skončily pod formulářem), `RegistrationFormFields.jsx:47,88,129,229`;
  - administrace: `RacerManagement.jsx:307,362`, `DocumentLibrary.jsx:242`, `CategoryForm.jsx:25` (sloupce dávají dohromady 15), `CoverageReport.jsx:25,86,96`, `AdminDashboard.jsx:99,101,236`, `AdminRegister.jsx:117`, `ClubManagement.jsx:98`, `RaceFilters.jsx:14`, `RaceRegistrations.jsx:105`, `PostFilters.jsx:43`, `PostForm.jsx:53`, `AttachmentManager.jsx:187` (prop `stacked`);
  - časomíra: `TimekeeperRacers.jsx:460,484,494,594`, `TimingEntry.jsx:429` (tabulka a schránka vedle sebe od 1200 px, `align-items-start`), `TimingDeviceSettings.jsx:200`, `RaceHeaderForm.jsx:165,166,175,184,205`, `ResultsView.jsx:277`, `SyncCenter.jsx:219`, `RaceNumbersManager.jsx:251`.
- [ ] Pořadí a sticky:
  - `Homepage.jsx:214,217,326`: na mobilu mají být závody nad aktualitami;
  - `Homepage.jsx:327`: sticky 80 px je vázané na výšku navbaru;
  - `SerialInboxPanel.jsx:83`: výška 72vh funguje jen díky `align-items-start`.
- [ ] Flexové pasti: `d-flex` přežije v `utilities.css`, ale `flex-column` a `gap` ne, takže se sloupce otočí do řádků.
  - veřejný web: `Homepage.jsx:232,242,263,424`, `RaceDetail.jsx:112,141`, `Registration.jsx:86`, `RacerSearchResults.jsx:40`, `RaceCalendar.jsx:192,215,216`, `PostCard.jsx:23,28,41` (`float` → grid);
  - administrace: `CategoryManagement.jsx:302`, `AdminDashboard.jsx:375`;
  - časomíra: `SerialStatusBar.jsx:49`, `TimekeeperDashboard.jsx:74,82,94`, `ResultsView.jsx:216`.

**8. Tabulky** → `Table` v `TableScroll`
- [ ] Vodorovné posouvání. Náhrada `table-responsive` v `components.css:310,376` platí jen do 768 px.
  - veřejný web: `LiveTiming.jsx:131`, `RaceCalendar.jsx:185`, `RegisteredRacersCard.jsx:42`;
  - administrace: `RacerManagement.jsx:385`, `DocumentLibrary.jsx:326`, `CategoryTable.jsx:34`, `RecalculateSummary.jsx:38`, `SeasonManagement.jsx:162`, `ClubManagement.jsx:148`, `ClubRequests.jsx:94`, `RaceTable.jsx:52`, `RaceRegistrations.jsx:160`, `PostTable.jsx:36`;
  - časomíra: `TimekeeperRacers.jsx:676`, `StartListManager.jsx:25,515` (min. 860 px), `TimingTable.jsx:39` (~700 px), `ConflictDialogMessage.jsx:20`, `ResultsTable.jsx:154`, `SyncCenter.jsx:289,338,381`.
- [ ] Šířka 100 %, `th` vlevo, `border-collapse`, oddělovače řádků:
  - veřejný web: `RaceCalendar.jsx:186`, `RegisteredRacersCard.jsx:43,44`;
  - administrace: `RacerManagement.jsx:386`, `CategoryTable.jsx:35,36`, `SeasonManagement.jsx:163`, `ClubManagement.jsx:149`, `ClubRequests.jsx:95,96`, `RaceTable.jsx:53,54`, `RaceRegistrations.jsx:161`, `PostTable.jsx:37`;
  - časomíra: `TimekeeperRacers.jsx:677`, `TimekeeperRacerRow.jsx:18`, `StartListRow.jsx:14`, `ConflictDialogMessage.jsx:21`, `ResultsTable.jsx:155,156`, `SyncCenter.jsx:290,339,382`;
  - `StartListManager.jsx:520`: `table-layout:fixed` potřebuje `width:100%`, jinak se rozbije sjednocení sloupců z commitu e28db67;
  - `TimingTable.jsx:40`: bez oddělovačů hrozí zápis času do vedlejšího řádku.
- [ ] Stav řádku vyjádřený jen barvou: `TimingRow.jsx:46`, `ResultsTable.jsx:171`, `SyncCenter.jsx:397` („neodesláno“), `ClubRequests.jsx:135`. Sticky hlavička: `RecalculateSummary.jsx:40`.

**9. Formuláře** → `Field`, `Input`/`Select`/`Textarea`, `Checkbox`/`Switch`, `InputAffix`, `Dropzone`/`FileButton`
- [ ] Popisky bez vazby `htmlFor`/`id`: `NewsFilters.jsx:21,34,50`, `RegistrationFormFields.jsx:49`, `RacerManagement.jsx:309,322,335,348`, `ClubRequests.jsx:159,170`, `PostFilters.jsx:45`, `RaceNumbersManager.jsx:251`, `TimingDeviceSettings.jsx:202`, `RaceHeaderForm.jsx:167-253`. Úplně bez popisku: `ClubDeleteDialog.jsx:43`, `TimingToolbar.jsx:136`, `SerialStatusBar.jsx:92`.
- [ ] Šířka a vzhled ovládacích prvků (bez `form-control` mají asi 20 znaků a žádný fokus):
  - veřejný web: `NewsFilters.jsx:39,55,58`, `RegistrationFormFields.jsx:55,116`;
  - administrace: `RacerManagement.jsx:491,534`, `DocumentLibrary.jsx:247,348`, `CategoryForm.jsx:31,51,66,85,106`, `AdminLogin.jsx:51`, `RaceFilters.jsx:18`, `RaceForm.jsx:55`, `PostFilters.jsx:48,93`, `PostForm.jsx:58`, `AttachmentList.jsx:66`, `AttachmentSlot.jsx:72`;
  - časomíra: `TimekeeperRacers.jsx:707`, `StartListManager.jsx:539`, `TimekeeperLogin.jsx:63,68,80,85`, `RaceHeaderForm.jsx:170`;
  - `TimingRow.jsx:70`: časy přetečou 90px sloupec a vypnuté pole vypadá editovatelně.
- [ ] Validace (chybí `aria-invalid`/`aria-describedby`):
  - `RegistrationFormFields.jsx:51,62,74,81,96,105,140,152,168,190,205`. Chyba klubu `:168` není sourozencem pole, takže obecné `display:none` by ji skrylo.
  - `AdminRegister.jsx:142,144,152,162,170,180,188,198,206`, `CategoryManagement.jsx:73`, `CategoryForm.jsx:28,40,58,63,81,102`, `SeasonManagement.jsx:264,282`;
  - `TimekeeperRacers.jsx:502,696,702`, `StartListManager.jsx:546`;
  - `NewsFilters.jsx:71`: počet výsledků bez `aria-live`.
- [ ] Přepínače a zaškrtávací pole: `CategoryForm.jsx:125`, `SeasonManagement.jsx:296`, `ClubManagement.jsx:121`, `AttachmentList.jsx:95` (jen `title`), `AttachmentSlot.jsx:54`, `AdminRegister.jsx:211`, `RaceForm.jsx:190,206`, `PostForm.jsx:85`.
- [ ] Pole s příponou: `SeasonManagement.jsx:272`, `RaceHeaderForm.jsx:247`.
- [ ] Soubory: `SyncCenter.jsx:272,275` (import zálohy nejde z klávesnice); dropzóny `AttachmentList.jsx:130`, `AttachmentSlot.jsx:121` (`admin.css:698-706`).

**10. Výběr a disabled vyjádřené jen barvou tlačítka** → `SegmentedControl`/`aria-pressed`, `Button :disabled`
- [ ] Vybranou volbu odlišuje jen `btn-primary` proti `btn-outline-*`:
  - veřejný web: `RaceCalendar.jsx:141`, `Registration.jsx:83,88-107`;
  - administrace: `VisitsChart.jsx:163`, `ClubRequests.jsx:139`, `RaceTable.jsx:86`;
  - časomíra: `RaceNumbersManager.jsx:276,355`, `TimingToolbar.jsx:98,161`, `TimekeeperDashboard.jsx:102`;
  - `TimingToolbar.jsx:189`: kolo zamyká vstupy druhého kola;
  - `TimingRow.jsx:108`: DNF/DNS/DSQ se ukládá hned;
  - `SerialStatusBar.jsx:173`: určuje, kam jdou impulzy;
  - `ResultsTable.jsx:115,128` spolu s `LiveTiming.jsx:112,116`. Výchozí je `btn-outline-dark`, `btn-outline-light` předává jen `LiveTiming`.
- [ ] Vypnuté tlačítko nevypadá jinak (bez `.btn:disabled`):
  - `ConfirmDialog.jsx:78`, `CategoryTable.jsx:100`;
  - `RaceCalendar.jsx:173-181`: obal `span` kvůli `title`, test `RaceCalendar.test.jsx:62`;
  - `RaceDetail.jsx:142-181`: „vypnutý“ odkaz zůstává v pořadí tabulátoru;
  - časomíra: `TimingToolbar.jsx:58`, `TimingRow.jsx:112`, `SerialStatusBar.jsx:119`, `SerialInboxPanel.jsx:65`, `ResultsView.jsx:233,241,253,264`, `ResultsPrintButtons.jsx:32,43`, `SyncCenter.jsx:264`, `TimekeeperLogin.jsx:97`;
  - `RegistrationForm.jsx:50`: chybí disabled, hrozí dvojí odeslání.
- [ ] Nebezpečnou a běžnou akci rozlišuje jen barva: `SerialInboxPanel.jsx:70`, `BridgeEventRow.jsx:128` (✓/✕ bez `aria-label`), `BridgeEventRow.jsx:108` (přepínání kandidátů).
- [ ] Vzhled tlačítek a skupin:
  - veřejný web: `Homepage.jsx:314,424,440`, `NewsFilters.jsx:77`, `RaceCalendar.jsx:237`, `RegistrationFormFields.jsx:173,210`;
  - administrace: `RacerManagement.jsx:43`, `DocumentLibrary.jsx:306`, `AdminLayout.jsx:141`, `AdminLogin.jsx:79`, `RaceRegistrations.jsx:94`, `PostManagement.jsx:13` (jméno kontroluje test), `AttachmentList.jsx:163`, `AttachmentSlot.jsx:150`;
  - časomíra: `TimekeeperLayout.jsx:296`, `ResultsPrintButtons.jsx:28`.

**11. Rozbalování** → `<button aria-expanded aria-controls>`
- [ ] `CoverageReport.jsx:170`, `SeasonManagement.jsx:196`, `ClubManagement.jsx:176`, `ClubRequests.jsx:127`, `RaceNumbersManager.jsx:319` (klikací `div`), `SyncCenter.jsx:317`.

**12. Odznaky a barevné stavy** → `Badge`, `BibChip`, `ResultStatus`, `FileTypeBadge`
- [ ] Tvar čísla dresu dává jen `.badge` (bez něj nepůsobí `minWidth`): `RaceNumberBadge.jsx:15`, `raceNumbers.js:18` a jeho spotřebitelé (`TimekeeperRacers.jsx:536`, `BridgeEventRow.jsx:116`, `ResultsTable`), `StartListManager.jsx:446`, `TimekeeperRacers.jsx:549`, barevná tečka `RaceNumbersManager.jsx:289`.
- [ ] Mezistav, kdy Bootstrap zmizí a `admin.css` zůstane:
  - bílý text na neplatném `rgba(var(--bs-*-rgb))` je neviditelný: `StartListRow.jsx:34` (DNS/DSQ), `StartListManager.jsx:511`;
  - bílé na bílém: `AdminLogin.jsx:32`;
  - body bez barvy textu: `ResultsTable.jsx:191`.
- [ ] Stav vyjádřený jen barvou: `BridgeEventRow.jsx:89,90,163`, `SyncCenter.jsx:205,224,402`, `SerialStatusBar.jsx:147,148`, `TimingDeviceSettings.jsx:216`, `TimingRow.jsx:102`, `ResultsTable.jsx:196`, `TimingToolbar.jsx:207` (jediný údaj o zamčeném kole), `TimekeeperLayout.jsx:171`, `RaceHeaderForm.jsx:158`, `CoverageReport.jsx:15`.
- [ ] Třídy Bootstrapu v datech: `utils/files.js:5` (volají ho `DocumentLibrary.jsx:342`, `LibraryPicker.jsx:98`, `AttachmentList.jsx:60`, `AttachmentSlot.jsx:90`); `RecalculateSummary.jsx:59` (`bg-pink`).
- [ ] Ostatní odznaky (text zůstává):
  - veřejný web: `Homepage.jsx:265,409,412`, `RaceDetail.jsx:132`, `RegisteredRacersCard.jsx:63,71,74,75`;
  - administrace: `AdminLayout.jsx:89` (počet bez kontextu), `AdminDashboard.jsx:201`, `ClubRequests.jsx:76,120`, `RaceTable.jsx:14,96`, `RaceRegistrations.jsx:183`, `PostTable.jsx:71,77`, `AttachmentSlot.jsx:106`;
  - časomíra: `TimekeeperRacers.jsx:621`, `SerialInboxPanel.jsx:48`, `ResultsView.jsx:328`.

**13. Hlášky** → `Alert`
- [ ] Sdílené a jejich kopie:
  - `Alert.jsx:57`: `fade`/`show` nechá neviditelný box, projeví se v `AdminRegister.jsx:122`;
  - `TimekeeperChrome.jsx:55`;
  - `RegistrationMessage.jsx:13`: chybí role;
  - vlastní kopie: `RaceNumbersManager.jsx:239` (`alert-${type}`), `ResultsView.jsx:300`.
- [ ] Závažnost nese jen barva:
  - `SerialStatusBar.jsx:32`: upozornění, že se časy neukládají;
  - bez role: `TimingDeviceSettings.jsx:182`, `VisitsChart.jsx:183`, `RecalculateSummary.jsx:10`;
  - `RaceDetail.jsx:192`: úspěch má `role=alert` a nezmizí;
  - veřejný web: `LiveTiming.jsx:79`, `Documents.jsx:97`, `Registration.jsx:153`, `NewsArchive.jsx:22`;
  - administrace: `CategoryManagement.jsx:276`, `CoverageReport.jsx:71,77,116,134,155,186,197,222,243,261,291,302`, `RaceFilters.jsx:40`, `LibraryPicker.jsx:78`;
  - časomíra: `SerialStatusBar.jsx:56`, `TimekeeperDashboard.jsx:158`, `SyncCenter.jsx:211`, `TimekeeperRacers.jsx:603`, `TimingEntry.jsx:469`, `RaceHeaderForm.jsx:152`;
  - typy zpráv z `useInboxEvents.js` (18× `setMessage`).

**14. Našeptávače** → `Combobox`, výběr klubu v `Modal`
- [ ] `SearchableSelect.jsx`:
  - `:121` portál se z-indexem 9999, pozice se počítá jen při otevření;
  - `:155`;
  - `:200` ikona drží na místě jen díky `d-flex`;
  - `:225,262` jediné „vymazat“ pro myš, z klávesnice nejde;
  - `:243` spouštěč je `div` bez role;
  - `:267`.
- [ ] `RaceForm.jsx:115,144`: bez `position-*` seznam odsune pole pod sebou. `RaceForm.jsx:127`: `div onClick`.

**15. Stránkování a průběh**
- [ ] `NewsPagination.jsx`:
  - `:59` bez `.pagination` svislý seznam s odrážkami;
  - `:20,34,48`;
  - `:19,47` předchozí/další jen jako ikona, bez jména;
  - `:32` aktuální strana bez `aria-current`.
- [ ] `TimingToolbar.jsx:116`: průběh bez `role=progressbar`.

**16. Klikací řádky seznamů** → `ListRow`/`OptionList`
- [ ] `Documents.jsx:33`: fokus bez zvýraznění, hover řeší JS.
- [ ] `RacerSearchResults.jsx:31,37`: výsledky jako šedá nativní tlačítka vedle sebe, bez `aria-live`, chybí stav „nic nenalezeno“.
- [ ] `LibraryPicker.jsx:92`, `TimingDeviceSettings.jsx:225`.

**17. Ořez a zalomení** → pravidla v modulu, `Truncate`
- [ ] Ořez:
  - `TimingRow.jsx:59,62`: jméno ustupuje časům, v tabulce je 250 řádků;
  - `BridgeEventRow.jsx:98`, `Homepage.jsx:399`, `DocumentLibrary.jsx:222,331,332,364,372,373,391`, `AdminDashboard.jsx:327`, `AttachmentList.jsx:64,85`, `AttachmentSlot.jsx:89,93,98`, `TimekeeperLayout.jsx:289`, `TimekeeperDashboard.jsx:95`;
  - `PostTable.jsx:57` je inline styl a zůstává.
- [ ] Řádkování přes `d-block`: `CoverageReport.jsx:98,106,117,122,135,140`, `RecalculateSummary.jsx:15,85,93,101`, `StartListManager.jsx:552`, `RaceNumberBadge.jsx:18`.

**18. Staré tokeny, háčky a CSS mimo Bootstrap** → `--ms-*`, přenos do modulů, `LegacyIsland`
- [ ] `body.theme-backoffice`: `useBodyClass.js:17`, `AdminRoutes.jsx:35`, `TimekeeperRoutes.jsx:34`.
- [ ] Pravidla vázaná na `.timekeeper-section` (`TimekeeperLayout.jsx:313`):
  - `admin.css:773-783`: min. šířka časů, bez ní „38.“ na 1280 px;
  - `:787-802`: pruh karty v `TimekeeperDashboard.jsx:73`;
  - `:804-880`: mřížka čísel v `RaceNumbersManager.jsx:404`.
  - Přenést i `admin.css:678-695` (výpustka `SearchableSelect`) a `:698-706` (dropzóna).
- [ ] Proměnné čtené z JSX:
  - `raceNumbers.js:5`: `--tk-set-*` jsou jen v `admin.css:90-94`, jinak platí fallbacky s kontrastem pod 4,5:1;
  - `TimekeeperChrome.jsx:16`: červené `TK_ACCENT*`;
  - `TimekeeperDashboard.jsx:106`: bez `--adm-danger` je tlačítko Live neviditelné;
  - `TimekeeperRacers.jsx:496`;
  - `--text-primary`, `--sunset-orange`, `--glass-bg`, `--text-secondary`, `--text-muted` ve 12 souborech (počítá `check:styles`).
- [ ] Natvrdo zapsaná paleta Bootstrapu nebo starého tématu: `CoverageReport.jsx:87`, `RecalculateSummary.jsx:91,99`, `AdminLayout.jsx:52-57,128`, `AdminDashboard.jsx:171,197` (neplatné `'white !important'`), `TimingTable.jsx:41`, `ResultsView.jsx:324`, `VisitsChart.jsx:61-139` (Chart.js).
- [ ] JSX `<style>`: `TimekeeperRacers.jsx:404` (přepisuje `.form-*` a `.list-group-item` potomků), `RegistrationFormFields.jsx:45`.
- [ ] Deklarace, které bez Bootstrapu umřou. Proto se staré CSS maže jen atomicky:
  - `admin.css:362`: `--bs-btn-border-width`, tlačítka přijdou o rámeček;
  - `admin.css:279,302-306,507,517,529-566,578,632-644,653-657`, `main.css:30-121`;
  - selektory podle názvů Bootstrapu: `admin.css:332-333,581,586,590`, `components.css:405`.

**19. Animace** → `LivePill` s vlastními `@keyframes` a `prefers-reduced-motion`
- [ ] `livePulse` je definovaný jen v `<style>` stránek: `Homepage.jsx:107`, `LiveTiming.jsx:144`, `TimekeeperDashboard.jsx:136`. Používají ho `Navigation.jsx:102` a `TimekeeperDashboard.jsx:113`, bez reduced-motion.

**20. Chování, které redesign mění (z auditu, nesouvisí s Bootstrapem)**
- [ ] Odkazy a navigace:
  - `Router.jsx:26`, `AdminDashboard.jsx:178`, `TimingTable.jsx:82`: `<a href>` načte celou stránku, offline je to problém → `ButtonLink`;
  - `AdminDashboard.jsx:386`: `target=_blank` bez `rel`;
  - `RaceCalendar.jsx:199`: `tr onClick`;
  - `LiveTiming.jsx:45`: přesměrování místo klidového stavu;
  - `AdminRoutes.jsx:39`: chybí catch-all.
- [ ] Data a stav:
  - `RaceDetail.jsx:209`: seznam přihlášených se zobrazuje vždy;
  - `RegistrationMessage.jsx:5`: typ se pozná podle emoji → `{type,text}`;
  - `TimekeeperRacers.jsx:746`: `list="clubs"` závisí na `<datalist>` z `RegistrationFormFields`;
  - `AdminDashboard.jsx:93`: Obnovit remountuje graf.
- [ ] Rozvržení obsahu:
  - `StartListManager.jsx:413`: panel se mění na dialog;
  - `Contacts.jsx:129`: vnořený scroll.

**21. Jen vzhled (Reboot, typografie, karty, list-group) — vyřeší přepsání obrazovky**
- [ ] Veřejný web a sdílené komponenty:
  - `Router.jsx:23`, `Contacts.jsx:76,80,91,130,134`, `Documents.jsx:45,50,52,129,146`, `LiveTiming.jsx:102`, `PostCard.jsx:47`, `Layout.jsx:39`, `Navigation.jsx:43`;
  - `Homepage.jsx:183,203,282` (282 je třída v HTML řetězci);
  - `EmptyState.jsx:11`, `RegistrationForm.jsx:10,24,67`, `RacerSearchResults.jsx:32,42`.
- [ ] Administrace:
  - `RacerManagement.jsx:41` funguje dál: `--bs-code-color` definuje `admin.css:143`, pravidlo je na `:675`;
  - `VisitsChart.jsx:192`: výšku 280 px zachovat;
  - `AdminLayout.jsx:113`, `AdminDashboard.jsx:254,290,324,385`, `ClubManagement.jsx:162`, `RaceManagement.jsx:18`, `RaceTable.jsx:74`, `RaceRegistrations.jsx:81`, `PostManagement.jsx:12`, `PostFilters.jsx:41`, `AttachmentList.jsx:57`, `AttachmentManager.jsx:162`.
- [ ] Časomíra:
  - `RaceNumbersManager.jsx:403`: vnitřní scroll zachovat;
  - `TimekeeperChrome.jsx:35` a `ResultsView.jsx:281`: falešné pole se stává kontextem závodu v liště;
  - `TimekeeperRacers.jsx:441,478,618`, `StartListManager.jsx:349`, `RaceNumbersManager.jsx:224`, `TimingToolbar.jsx:50,85`, `TimingDeviceSettings.jsx:250`, `TimekeeperLayout.jsx:150,165`, `TimekeeperLogin.jsx:123`, `ResultsTable.jsx:117`, `SyncCenter.jsx:336`.
- [ ] Mrtvé selektory ke smazání: `RaceCalendar.jsx:126`, `components.css:439`.

## Úpravy fází

**Pořadí provádění:** 1 → Ikony → 2 → 3 → **5 → 4** → 6 → 7. Časomíra jde před administraci, aby nejrizikovější sekce měla nejdelší zkoušení na podm12.com před jediným vydáním na produkci. Čísla fází zůstávají.

**Fáze 1 — doplnit na začátek, před první nový styl**
- [ ] **Nasazení D0 „staré CSS do vrstvy“** (samostatné, beze změny vzhledu):
  - V `main.css` přidat `layer(legacy)` ke všem 9 `@import` (CDN `:4` a `:28` zůstávají na CDN) a blok `:30-155` obalit `@layer legacy {}`.
  - Obsah `<style>` v `index.html:17-125` obalit `@layer legacy {}` a **nechat ho v `index.html`**. Vite přesouvá externí `@import` na začátek balíčku, takže přesun bloku do souboru by změnil jeho pořadí vůči Bootstrapu.
  - Obalit 6 JSX `<style>`: `Homepage.jsx:107`, `LiveTiming.jsx:144`, `TimekeeperDashboard.jsx:136`, `TimekeeperLayout.jsx:61`, `TimekeeperRacers.jsx:404`, `RegistrationFormFields.jsx:45`. Bez vrstvy by přebily všechno staré.
  - Smazat import `App.jsx:2`.
- [ ] Kontrola D0:
  - V `dist/assets/index-*.css` mají CDN importy `layer(legacy)` a partialy jsou v `@layer legacy{…}`. Záloha, kdyby to nešlo: obalit obsah partialů textově.
  - Brána: screenshoty asi 25 stavů před a po na 1600 a 390 px (šest obrazovek se `<style>`, `.btn-primary`, barvy odznaků, z-index modalu, patička) a namátkou `getComputedStyle`.
  - Image otagovat, aby šlo vrátit.
- [ ] K odrážce `tokens.css` doplnit:
  - `--ms-bib-*` (hodnoty z `admin.css:90-94`), `--ms-space-*`, poloměry 3 a 4 px, `--ms-font-*`, `--ms-z-*` (do Fáze 6 všechny < 1000);
  - `components/ms/tokens.js` jako JS zrcadlo pro Chart.js a `raceNumbers.js`, s testem shody s `tokens.css`;
  - test kontrastu každé deklarované dvojice barev výpočtem.
- [ ] `base.css` bez `@layer`:
  - Celý reset je v `:where(.ms-scope)`, tedy s nulovou specificitou.
  - Kořen nastaví `color`, `font`, `line-height` a `background`.
  - `h1–h6`, `p`, `ul`, `ol`, `li`, `figure` dostanou margin 0; seznamy padding 0.
  - Nadpisy `font` a `color: inherit`; ovládací prvky `font:inherit; color:inherit`.
  - `table{border-collapse:collapse}`, `th{text-align:start}`, `th,td{padding:0}`.
  - `a` navy s vlastním hoverem; `:focus:not(:focus-visible){outline:none}` a navy `:focus-visible`; `img{max-width:100%;height:auto}`.
  - Globálně: `box-sizing`, `[hidden]{display:none!important}`, `.ms-sr-only`, reduced-motion.
  - Styly komponent patří jen do `*.module.css`.
- [ ] Písma:
  - Z `@fontsource/*` importovat jen soubory `latin` a `latin-ext`.
  - Vite plugin (`transformIndexHtml`) vloží `<link rel="preload" as="font" type="font/woff2" crossorigin>` s hashovanými URL, takže je `precacheShell` (`sw.js:57-67`) předkešuje.
  - Test v `serviceWorker.test.js` (fixture `:117-122`): preload písma skončí v keši.
  - Zvednout `CACHE_NAME` (`sw.js:20`, test `:317`).
  - Do `index.html` přidat `lang="cs"`.
- [ ] Primitiva doplnit o:
  - akce: `IconButton` (povinný `label`, v dev jinak výjimka), `CloseButton`, `ButtonLink`, `SegmentedControl`;
  - formulářové prvky: `Checkbox`, `Switch`, `InputAffix`, `Combobox`, `Dropzone`/`FileButton`;
  - zobrazení dat: `Table` + `TableScroll`, `Pagination`, `ProgressBar`, `List`/`ListRow`/`OptionList`, `BibChip`, `ResultStatus`, `Truncate`;
  - načítání a přístupnost: `Spinner`, `VisuallyHidden`;
  - rozvržení: `Container`/`Stack`/`Cluster`/`Grid`/`Split`, `Screen`, `LegacyIsland`.
  - Testy kontrolují role, `aria-pressed`, `aria-current` a `aria-invalid`.
- [ ] `Modal` konkrétně:
  - `showModal()` ve stromu DOM, kořen má `.ms-scope`.
  - Slib `useConfirm` se splní i na nativní `close`. Jinak Escape přes close-watcher nechá viset `conflictOpenRef` v `useTimeSaving.jsx:166`.
  - `dismissible={false}`: když se dialog zavře bez souhlasu, znovu zavolat `showModal()`.
  - Počáteční fokus na „Zrušit“ nebo na volbu označenou `safe`.
  - Zámek scrollu přes `html:has(dialog[open])` a návrat fokusu.
  - `src/test/setup.js`: stub `HTMLDialogElement.prototype.showModal/close` (jsdom 25 je nemá) a stub `matchMedia`.
- [ ] Odrážky „`ConfirmDialog` přepsat…“ a „`EmptyState`, `LoadingState`, `Alert`“ rozdělit do **tří nasazení**, každé s generálkou časomíry:
  - (a) `LoadingState`/`ButtonSpinner`/`EmptyState`/`Alert`/`TimekeeperMessage`/`RegistrationMessage`; `useRegistration` vrací `{type,text}`.
  - (b) `ConfirmDialog`/`useConfirm` na `Modal`; nativní dialogy `useRaceManagement.js:261`, `usePostManagement.js:196`, `RaceNumbersManager.jsx:127`, `ClubRequests.jsx:52`.
  - (c) `PdfPreviewModal` (`size="full"`) a obal `LibraryPicker`.
  - API zůstává: `variant` se mapuje na tón, `icon` na název `Icon`.
- [ ] `navigation.test.js` (`:25,38,59,81`) přepsat na data:
  - Menu se čtou z polí exportovaných z `components/ms/navItems.js`; `<Route path="…">` zůstává doslovně.
  - Udělat to před změnou prvního rámce, jinak veřejný test projde naprázdno.
- [ ] Pojistka `scripts/check-styles.mjs` + `src/test/legacyStyles.test.js` + `scripts/style-baseline.json`:
  - Pro každý soubor počítá:
    - třídy Bootstrapu 5.3 z úplného slovníku, ne jen použité, i v šablonách `btn-${`, `alert-${`, `bg-${` a v HTML řetězcích;
    - `bi-` a `--bs-`;
    - staré proměnné `--text-primary`, `--sunset-orange`, `--glass-bg`, `--text-secondary`, `--text-muted`, `--tk-*`, `--adm-*`, `--jmlp-*`;
    - `theme-backoffice`, emoji a importy starých UI komponent.
  - Počty smí jen klesat. `components/ms/**` a každý soubor se `*.module.css` musí mít nulu.
  - V `components/ms/**` a `*.module.css` navíc zakazuje:
    - hexy mimo `tokens.css`/`tokens.js`;
    - `!important` (kromě `[hidden]` a reduced-motion);
    - `@media` mimo 768/1024/1280 a `z-index` mimo `var(--ms-z-*)`;
    - globální selektory mimo `base.css`;
    - `style={{}}` s čímkoli jiným než custom properties.
  - `npm run check:styles -- --final` je brána Fáze 6.
- [ ] Kanárek:
  - `JMLP_NO_LEGACY=1` ve `vite.config.js` přesměruje `src/assets/styles/main.css` na prázdný soubor a plugin vyhodí `<style>` z `index.html`.
  - Spuštění: `JMLP_NO_LEGACY=1 npx vite build --outDir dist-canary && npx vite preview --outDir dist-canary`, jen lokálně.
  - Obrazovka je hotová, až vypadá stejně v běžném i kanárkovém buildu na 1600, 1280 a 390 px, včetně dialogů a stavů chyby, prázdna a načítání.
  - Metrika postupu = počet rout v tomto stavu.
- [ ] `CLAUDE.md`, nová sekce „Modrá stopa UI“:
  - kit je jediný slovník;
  - pravidla z `check:styles`;
  - postup převodu artboardu: signaturní prvek → komponenta, zbytek do modulu obrazovky, px na nejbližší token;
  - zákaz stylových závislostí (Tailwind, react-bootstrap, písma z CDN).

**Nové nasazení „Ikony“ — hned po Fázi 1**
- [ ] Kodemod asi 400 výskytů `bi-*` (131 názvů, 69 souborů) na `<Icon name>`:
  - `className` se předává dál, takže `me-*`, `fs-1` a `display-1` fungují, dokud je Bootstrap načtený;
  - ikona má `1em` a `vertical-align:-0.125em`;
  - neznámý název vyhodí výjimku v dev a v testech.
- [ ] Dynamické zdroje přejmenovat přímo na názvy `Icon`, bez aliasové mapy:
  - prop `EmptyState` (15 volání);
  - `choice.icon`: `useTimeSaving.jsx:173-174`, `useInboxEvents.js:467,485,505`, `AttachmentManager.jsx:147-148` a ostatní volající `confirm`;
  - `MESSAGE_ICONS` (`TimekeeperChrome.jsx:56`), `ResultsView.jsx:301`, `RaceNumbersManager.jsx:233,240,322,370`, `TimekeeperLayout.jsx:174`;
  - `Navigation.jsx:79`, `SearchableSelect.jsx:267`, `CoverageReport.jsx:90,176`, `CategoryTable.jsx:109`, `RaceTable.jsx:91`, `StartListManager.jsx:373`, `Homepage.jsx:427`, `DocumentLibrary.jsx:226`.
- [ ] Ve stejném průchodu:
  - `aria-label` všem ikonovým tlačítkům a odkazům ze skupiny 4;
  - text stavovým ikonám: `ResultsTable.jsx:199` „Dokončil“, `SeasonManagement.jsx:190` a `ClubManagement.jsx:170` „Ano/Ne“, `TimingTable.jsx:47` skrytý text „Kolo zamčeno“;
  - `title="Upravit"` nechat kvůli `PostManagement.test.jsx:83`.
- [ ] Smazat `main.css:28`.
  - Brána: `bi-` = 0 v `check:styles`, screenshoty, generálka časomíry.
  - Offline start časomíry pak nezávisí na ikonovém fontu z CDN (`sw.js:142` cizí originy nekešuje).

**Fáze 2 — upravit**
- [ ] Nahradit odrážku „Veřejné stránky obalit `.ms-scope`; odstranit fotku na pozadí a glass efekt“:
  - Nový rámec je `.ms-scope`: `SiteHeader`, patička, `MobileMenu` jako `Modal`, hamburger jako `IconButton aria-expanded aria-controls`.
  - Každou nepřevedenou stránku obalit `<LegacyIsland variant="public">`. Ten drží staré obaly `main-content > content-wrapper > row justify-content-center > col-lg-10` (u Úvodu `fluid`), tmavou fotku a bílý text.
  - Světlé pozadí nastavuje jen převedená obrazovka: `Screen` → `body.ms-page` přes počítaný `useBodyClass`.
  - Fotka a glass zmizí až s poslední veřejnou stránkou.
- [ ] `LivePill` s vlastními `@keyframes`. Dnes `Navigation.jsx:102` pulzuje jen na stránkách, které mají `<style>`.
- [ ] Přechodová pravidla, dokud žijí staré modaly:
  - nové `z-index` < 1000 (`.navbar` má 1030, `.modal` 1055, `SearchableSelect` 9999);
  - na předcích `LegacyIsland` žádný `transform`, `filter`, `backdrop-filter`, `contain` ani `will-change`, protože rozbijí `position:fixed` starého modalu;
  - uvnitř `Modal` žádný popover portálovaný do `body`.

**Fáze 3 — doplnit**
- [ ] Sdílené komponenty rozdělit na kopie, ne přestylovat na místě:
  - Veřejná kopie `RegistrationForm`/`RegistrationFormFields`/`RacerSearchResults`. Časomíra drží staré až do Fáze 5, včetně `<datalist id="clubs">` pro `TimekeeperRacers.jsx:746`.
  - Veřejná `ResultsTable`/`CategoryPills`. Čisté funkce jdou do `utils/results.js` a `ResultsTable.jsx` je re-exportuje kvůli `ResultsTable.test.jsx`.
  - Výběr klubu přes `Combobox` nebo `DialogVyberKlubu`; starý `SearchableSelect` zůstává administraci.
- [ ] `RaceCalendar.test.jsx:62-81` upravit ve stejném PR jako `<select>` sezóny. Zachovat vypnuté tlačítko /Průběžné výsledky/ a odkaz /Celkové výsledky/.
- [ ] Výstup fáze:
  - žádný `LegacyIsland variant="public"`;
  - smazané staré `Layout.jsx`, `Navigation.jsx`, `Registration.jsx`, `RegistrationMessage.jsx`;
  - kanárek: všechny veřejné routy v pořádku.

**Fáze 5 (časomíra) — doplnit; provádět před Fází 4**
- [ ] Rámec jako první:
  - Každou routu obalit `<LegacyIsland variant="tk">` (drží `.timekeeper-section` a `container-fluid`).
  - `useBodyClass('theme-backoffice')` zůstává do převedení poslední staré obrazovky sekce.
  - `screens.test.jsx:74-76` přepsat na `within(nav)`/`getAllByRole`.
- [ ] Každé nasazení časomíry projde generálkou v tomto pořadí:
  1. Online načtení a instalace SW.
  2. Režim letadlo a studený start `/timekeeper`.
  3. Písma a ikony jsou v pořádku.
  4. Čas se zařadí do fronty a po připojení se odešle.
  5. Konflikt revize má fokus na bezpečné volbě.
  6. Náhled PDF.
  7. Sériové zařízení (skutečné, nebo přehraný log).
- [ ] Zadávání časů ve třech nasazeních:
  - (a) `TimingToolbar`, `SerialStatusBar`, `SerialInboxPanel`/`BridgeEventRow`, stavy textem místo barvy.
  - (b) `TimingTable`/`TimingRow`: do `TimingRow.module.css` přenést `admin.css:773-783` (šířka `calc(6ch + 14px)`, skryté šipky). Zachovat `React.memo` a zmrazené konstanty stylů.
  - (c) `useTimeSaving`/`useInboxEvents` na `useConfirm` s bezpečnou volbou jako první.
- [ ] Zařízení: přestylovat zvlášť od přestavby na `useSerialSession`. Přestavbu testovat se skutečným zařízením.
- [ ] Čísla a tokeny:
  - mřížku z `admin.css:804-880` přenést do modulu;
  - `raceNumbers.js` přepnout na `--ms-bib-*`;
  - `TK_ACCENT*` a `--adm-danger` (`TimekeeperDashboard.jsx:106`) přepnout na navy tokeny;
  - pruh karty (`admin.css:787-802`) nahradí stavová lišta `DataRow`.
- [ ] Zachovat, na co se spoléhají testy:
  - `BridgeEventRow.test.jsx:53-80`: „st. č.“, pořadí jména, „1/2“;
  - `ResultsTable.test.jsx:168-181`: sémantická `<table>`, jeden řádek hlavičky, „Body“.
- [ ] CSS modulů časomíry jede v jejím lazy chunku a do keše se dostane spolu s JS při první online návštěvě `/timekeeper`, stejně jako dnes. Do předávací poznámky zapsat postup: po každém vydání každý notebook jednou online otevře `/timekeeper`.
- [ ] Výstup fáze:
  - žádný `LegacyIsland variant="tk"`;
  - `useBodyClass` je pryč z `TimekeeperRoutes.jsx:34`;
  - smazané staré `RegistrationFormFields`, `RacerSearchResults` a `ResultsTable`.

**Fáze 4 (administrace) — doplnit**
- [ ] Rámec s `<LegacyIsland variant="admin">` (drží `admin-layout-content`, `container-fluid`, `p-4`). Zachovat posluchač `club-request-resolved`.
- [ ] Testy upravit ve stejném PR jako obrazovku:
  - `PostManagement.test.jsx:83-119`;
  - `ClubManagement.test.jsx:67-161`: nativní `<select>` „Platnost klubu“ a „Převést na klub“, `aria-label` „Smazat klub …“.
- [ ] `utils/files.js:5-25` vrací klíč tónu místo `bg-*`.
- [ ] Poslední odrážku nahradit výstupem fáze:
  - žádný `LegacyIsland`;
  - smazaný `useBodyClass.js` i jeho volání v `AdminRoutes.jsx:35`;
  - smazaný `SearchableSelect.jsx`;
  - `useConfirm` bez `variant`/`bi-`.

**Fáze 6 — nahradit první dvě odrážky**
- [ ] Předpoklady:
  - `npm run check:styles -- --final` hlásí 0 v `src/`, `index.html` a `public/`, včetně řetězců `bootstrap`/`cdn.jsdelivr`, `components/ui/ALERT_USAGE.md` a komentářů v 7 JSX souborech;
  - kanárek schválený na všech routách a stavech dialogů (1600/1280/390);
  - úplná generálka časomíry.
- [ ] Jeden commit:
  - smazat celé `src/assets/styles/` (včetně `main.css:4`), `<style>` z `index.html`, `background.jpg`, `LegacyIsland`, `useBodyClass.js` a alias `JMLP_NO_LEGACY`;
  - `main.jsx` importuje jen `styles/ms`;
  - reset v `base.css` přepnout z `:where(.ms-scope)` na celý dokument;
  - zrušit omezení `z-index` < 1000.
  - Bootstrap nikdy neodstraňovat bez starého CSS ani naopak (viz Rizika).
- [ ] K odrážce `CACHE_NAME` přidat:
  - `manifest.json:8-9`: `theme_color`/`background_color` na navy a `#F4F8FB`, nový název;
  - `<meta name="theme-color">`;
  - nové favicony (`sw.js:35`, `serviceWorker.test.js:183`);
  - `nginx.conf:191`: `immutable` jen pro `^/assets/`;
  - `nginx.conf:175`: `image/svg+xml` do `gzip_types`, pokud přibude SVG favicona.

**Mimo redesign — doplnit**
- [ ] `useTimeSaving.jsx:172-175`: dát „Ponechat hodnotu ze serveru“ jako první volbu. `ConfirmDialog` fokusuje první volbu, takže dnes na produkci stačí Enter při zápisu časů a hodnota na serveru se přepíše.

## Rizika

| Riziko | Opatření |
|---|---|
| D0 změní dnešní vzhled: JSX `<style>` bez vrstvy by přebily vše a Vite přesouvá CDN `@import` na začátek. | Inline blok zůstává v `index.html`, JSX bloky jsou obalené, `dist` se kontroluje, brána jsou screenshoty ~25 stavů, samostatné otagované nasazení. |
| Staré elementové styly prosáknou do nových obrazovek: `h1–h6` `#f1f5f9`, oranžové odkazy, `li{margin-bottom}`, `*:focus`, bílý `body`, padding buněk ≤ 768 px, `.admin-layout-content :is(h1,h2)`. | Reset v `:where(.ms-scope)` s explicitní barvou a písmem kořene. Každý rozdíl mezi běžným a kanárkovým buildem je chyba. |
| Staré `!important` přebije nové CSS, protože důležité deklarace v nižší vrstvě vyhrávají. | Hashované třídy nesdílí selektor se starými. Jediné elementové `!important` je `footer` (`layout.css:70`). Nové CSS nepoužívá `!important`. |
| Bootstrap zmizí dřív než staré CSS, nebo naopak. Pak: `utilities.css:114-130` s jinými breakpointy, `*-5` = 2rem místo 3rem, `admin.css:362` zruší rámeček všech tlačítek, mrtvé `--bs-*` (přepínače, tabulky, modaly), `table-responsive` jen do 768 px, neviditelné DNS/DSQ. | Jen atomický řez ve Fázi 6 s bránou `--final` a kanárkem. |
| Tmavý starý obsah skončí na světlé stránce, nebo nové rámce ztratí háčky starého CSS (časy „38.“ na 1280 px, mřížka čísel, šířka `col-lg-10`). | `LegacyIsland` drží staré obaly i tmavé pozadí. Světlé pozadí jen s `body.ms-page`. Funkční pravidla se přenesou ve stejném nasazení jako obrazovka. |
| Nativní `<dialog>`: jsdom nemá `showModal`, close-watcher zavře dialog bez `cancel`, portál `SearchableSelect` skončí pod top layer, starší prohlížeče nemají `@layer`, `:has()` ani `<dialog>`. | Stub v `setup.js`. Slib se splní na `close`, nezavíratelný dialog se znovu otevře, portály v `Modal` jsou zakázané. Před Fází 2 projít UA v `/visitor-log` (Safari < 15.4, Chrome < 105); pokud se objeví, zámek scrollu v JS místo `:has()`. |
| Výměna sdílených komponent zasáhne všechny sekce najednou, včetně konfliktu revize. | Tři nasazení adaptérů s generálkou, API beze změny, fokus na bezpečné volbě. |
| Časomíra offline bez nových písem nebo CSS. | Písma přes Vite (hash, stejný origin) + preload → předkešování. Ikony v JS. Generálka u každého nasazení. Po vydání každý notebook jednou otevře `/timekeeper` online. |
| Sdílená komponenta přestylovaná pro jednu sekci rozbije druhou (`ResultsTable`, `RegistrationFormFields`, `SearchableSelect`, `raceNumbers.js`). | Samostatná kopie pro každou sekci, logika v `utils`, smazání s posledním uživatelem (`check:styles`, `check:orphans`). |
| Testy vázané na jména a strukturu spadnou, nebo tiše zeslábnou. | Datový `navigation.test.js` před změnou rámců. Úprava testu ve stejném PR. Nativní `<select>`, `<table>` a `<button disabled>` tam, kde na nich testy stojí. |
| Bootstrap se vrátí pod jiným jménem (utility třídy, 12sloupcový grid) nebo se opíšou inline styly z artboardů. | `check:styles` zakazuje globální třídy, hexy, `!important` a `style={{}}` s čímkoli jiným než custom properties. Primitiva mají jen `gap`. Pravidla jsou v `CLAUDE.md`. |
| Řez zablokují nové funkce (`TkMobilZadavaniCasu`, seznam účtů, přestavba Zařízení, endpoint výsledků). | Podmínkou řezu je jen převedení existujících obrazovek. Nové funkce jdou samostatně. Povolený je „minimální port“ obrazovky bez nových funkcí. |