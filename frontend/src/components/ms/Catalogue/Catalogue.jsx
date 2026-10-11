import { useState } from 'react';
import {
  Alert, Badge, BibDate, Button, ButtonLink, Checkbox, CloseButton, Cluster, Container, DataRow, EmptyState,
  Field, Grid, Icon, IconButton, Input, LoadingState, Modal, PageHeader, Pagination, Panel, Paska, PasswordInput,
  SegmentedControl, Select, Spinner, Split, Stack, Switch, Table, TableScroll, Textarea, VisuallyHidden,
} from '../index.js';
import { cx } from '../cx.js';
import { ICONS } from '../Icon/icons.js';
import { adminNav, publicLiveNav, publicNav, timekeeperNav } from '../navItems.js';
import { bibColors, bibVar, colors, cssVar } from '../tokens.js';
import styles from './Catalogue.module.css';

/**
 * Katalog kitu Modré stopy pro rychlou vizuální kontrolu proti artboardům.
 * Jen v dev buildu (route /__ms v Router.jsx za import.meta.env.DEV).
 */
export default function Catalogue() {
  return (
    <div className={cx('ms-scope', styles.page)}>
      <Container as="main">
        <Stack gap={12}>
          <PageHeader eyebrow="Jen pro vývoj" title="Kit Modré stopy" description="Všechny komponenty z components/ms ve všech variantách. Porovnávej s artboardy na 1600 a 390 px." />
          <ColorsSection />
          <ActionsSection />
          <IconsSection />
          <DataSection />
          <FormsSection />
          <StatesSection />
          <ModalSection />
          <LayoutSection />
          <NavSection />
        </Stack>
      </Container>
    </div>
  );
}

function Swatches({ entries, toVar }) {
  return (
    <Grid min="150px" gap={3}>
      {Object.entries(entries).map(([name, value]) => (
        <div key={name} className={styles.swatch}>
          <span className={styles.chip} style={{ '--swatch': `var(${toVar(name)})` }} />
          <code className={styles.code}>{toVar(name)}</code>
          <span className={styles.code}>{value}</span>
        </div>
      ))}
    </Grid>
  );
}

function ColorsSection() {
  return (
    <Stack as="section" gap={5}>
      <Paska>Barvy</Paska>
      <Swatches entries={colors} toVar={cssVar} />
      <Swatches entries={bibColors} toVar={bibVar} />
    </Stack>
  );
}

function ActionsSection() {
  return (
    <Stack as="section" gap={5}>
      <Paska>Akce</Paska>
      {['lg', 'md', 'sm'].map((size) => (
        <Cluster key={size} gap={3}>
          <Button variant="primary" size={size} icon="plus">Nový závod</Button>
          <Button size={size} icon="download">Export CSV</Button>
          <Button variant="danger" size={size} icon="trash">Smazat závod</Button>
          <Button variant="quiet" size={size}>Zrušit</Button>
          <Button variant="open" size={size} icon="undo">Vrátit</Button>
          <Button size={size} disabled>Přihlášky uzavřeny</Button>
          <Button variant="primary" size={size} busy>Ukládám</Button>
        </Cluster>
      ))}
      <Cluster gap={3}>
        <ButtonLink to="/zavody" icon="calendar">Kalendář závodů</ButtonLink>
        <IconButton icon="pencil" label="Upravit závod" />
        <IconButton icon="trash" label="Smazat závod" variant="danger" />
        <IconButton icon="menu" label="Otevřít menu" variant="quiet" />
        <span className={styles.dark}><IconButton icon="logout" label="Odhlásit se" variant="on-dark" /></span>
        <CloseButton label="Zavřít ukázku" />
      </Cluster>
    </Stack>
  );
}

function DataSection() {
  const [page, setPage] = useState(1);
  return (
    <Stack as="section" gap={5}>
      <Paska aside="2 závody">Zobrazení dat</Paska>
      <Cluster gap={3}>
        <Badge tone="open" icon="check">Přihlášky otevřeny</Badge>
        <Badge tone="live">Živě</Badge>
        <Badge tone="closed">Uzavřeno</Badge>
        <Badge tone="neutral">Ukončen</Badge>
        <Badge tone="dry">Suchý závod</Badge>
        <Badge tone="navy">Admin</Badge>
        <Badge tone="count">3</Badge>
        <Badge tone="open" size="sm">Registrace otevřená</Badge>
      </Cluster>
      <Cluster gap={8} align="end">
        <BibDate date="2026-10-03" variant="card" />
        <BibDate date="2026-10-03" variant="table" />
        <BibDate date="2026-10-03" variant="row" />
      </Cluster>
      <Panel padding="none" as="ul">
        <DataRow as="li" tone="open" statusLabel="Registrace otevřená" lead={<BibDate date="2026-10-03" variant="row" />}
          title="Brno – Kohoutovice" meta="FreeSki Academy Brno · suchý slalom" value="58" />
        <DataRow as="li" tone="closed" statusLabel="Uzavřeno" lead={<BibDate date="2026-10-10" variant="row" />}
          title="Brno – Kraví hora" meta="SKI KLUB JUNIOR BRNO · přespolní běh" value="0">
          <Badge tone="closed" size="sm">Uzavřeno</Badge>
        </DataRow>
      </Panel>
      <DataRow variant="card" tone="open" statusLabel="Registrace otevřená" lead={<BibDate date="2026-10-03" variant="list" />}
        title="Brno – Kohoutovice" meta="FreeSki Academy Brno · 1. závod sezóny"
        aside={<Badge tone="open" icon="check">Registrace otevřena</Badge>} />
      <TableScroll label="Ukázková tabulka">
        <Table caption="Závody sezóny 2026/27" stickyHeader>
          <thead>
            <tr><th scope="col">Datum</th><th scope="col">Závod</th><th scope="col">Registrace</th><th scope="col" data-align="end">Přihl.</th></tr>
          </thead>
          <tbody>
            <tr data-state="open"><td><BibDate date="2026-10-03" /></td><td>Brno – Kohoutovice</td><td><Badge tone="open" size="sm">Registrace otevřená</Badge></td><td data-align="end" data-numeric>58</td></tr>
            <tr data-state="error"><td><BibDate date="2026-10-10" /></td><td>Brno – Kraví hora</td><td><Badge tone="closed" size="sm">Uzavřeno</Badge></td><td data-align="end" data-numeric>0</td></tr>
          </tbody>
        </Table>
      </TableScroll>
      <Pagination page={page} pageCount={12} onChange={setPage} label="Stránkování ukázky" />
    </Stack>
  );
}

function FormsSection() {
  const [filter, setFilter] = useState('all');
  const [state, setState] = useState(null);
  return (
    <Stack as="section" gap={5}>
      <Paska>Formuláře</Paska>
      <Grid columns={3} gap={4}>
        <Field label="Jméno" hint="Jak je v průkazu" required><Input placeholder="Zadejte jméno" size="lg" /></Field>
        <Field label="Příjmení" error="Napište příjmení závodníka." required><Input size="lg" /></Field>
        <Field label="Sezóna">
          <Select><option>Sezóna 2026/27 — XX. ročník</option><option>Sezóna 2025/26 — XIX. ročník</option></Select>
        </Field>
        <Field label="Čas 1. kola"><Input mono size="sm" defaultValue="57,37" /></Field>
        <Field label="Vypnuté pole"><Input disabled defaultValue="Nelze měnit" /></Field>
        <Field label="Heslo"><PasswordInput /></Field>
        <Field label="Poznámka"><Textarea placeholder="Text příspěvku" /></Field>
      </Grid>
      <Cluster gap={8}>
        <Checkbox label="Zveřejnit" description="Uvidí ho všichni návštěvníci" />
        <Switch label="Automatický zápis" description="Jednoznačné impulzy se zapíšou samy" defaultChecked />
        <Switch label="Vypnutý přepínač" disabled />
      </Cluster>
      <SegmentedControl label="Typ závodu" value={filter} onChange={setFilter} options={[
        { value: 'all', label: 'Vše (2)' },
        { value: 'snow', label: 'Na sněhu (0)', icon: 'snowflake' },
        { value: 'dry', label: 'Suché (2)' },
      ]} />
      <SegmentedControl label="Stav 1. kola" size="sm" value={state} onChange={setState} allowDeselect options={[
        { value: 'dnf', label: 'DNF' }, { value: 'dns', label: 'DNS' }, { value: 'dsq', label: 'DSQ' },
      ]} />
    </Stack>
  );
}

function StatesSection() {
  return (
    <Stack as="section" gap={5}>
      <Paska>Stavy a hlášky</Paska>
      <Cluster gap={8}>
        <Spinner />
        <LoadingState label="Načítám aktuality…" />
        <LoadingState variant="inline" label="Načítám…" />
      </Cluster>
      <Alert type="danger" title="Aktuality se teď nepodařilo načíst" actions={<Button icon="refresh">Zkusit znovu</Button>}>
        Web se nedostal k seznamu zpráv. Zkuste to za chvíli znovu.
      </Alert>
      <Alert type="warning" onDismiss={() => {}}>Spojení s časomírou se přerušilo. Časy níže jsou z té chvíle.</Alert>
      <Alert type="info" compact>Stránkování se ukáže, až bude zpráv víc než 10.</Alert>
      <Alert type="success" autoDismissDelay={0} compact onDismiss={() => {}}>Závod uložen.</Alert>
      <EmptyState size="lg" icon="search" title="Hledání „štafeta“ nic nenašlo"
        hint="Zkuste kratší nebo jiný výraz, nebo filtry vymažte." action={<Button icon="close">Vymazat filtry</Button>} />
      <EmptyState icon="inbox" title="Zatím žádné přihlášky" hint="Registrace se otevře v pondělí." />
      <p>Skrytý text pro čtečky: „<VisuallyHidden>tohle není vidět</VisuallyHidden>“.</p>
    </Stack>
  );
}

function ModalSection() {
  const [open, setOpen] = useState(null);
  const close = () => setOpen(null);
  return (
    <Stack as="section" gap={5}>
      <Paska>Dialogy</Paska>
      <Cluster gap={3}>
        <Button onClick={() => setOpen('danger')}>Nebezpečná akce</Button>
        <Button onClick={() => setOpen('choice')}>Více voleb</Button>
        <Button onClick={() => setOpen('blocking')}>Nezavíratelný</Button>
      </Cluster>
      <Modal open={open === 'danger'} onClose={close} eyebrow="Nebezpečná akce" title="Odebrat Kučeru Štěpána ze startovní listiny?"
        footer={<><Button data-cancel onClick={close}>Zrušit</Button><Button variant="danger" icon="trash" onClick={close}>Odebrat Kučeru Štěpána</Button></>}>
        <p>Zmizí řádek i příznak DNS. Přihláška na závod zůstane.</p>
      </Modal>
      <Modal open={open === 'choice'} onClose={close} eyebrow="Více voleb" title="Čas dresu 22 se mezitím změnil"
        footerStart={<Button variant="danger" onClick={close}>Přepsat na 35,90</Button>}
        footer={<><Button data-cancel onClick={close}>Zrušit</Button><Button variant="primary" icon="check" data-autofocus onClick={close}>Ponechat 35,87</Button></>}>
        <p>Vyberte, která hodnota platí. Zrušit nechá konflikt otevřený.</p>
      </Modal>
      <Modal open={open === 'blocking'} onClose={close} dismissible={false} eyebrow="Volba čeká na odpověď" title="Odhlásit se s neodeslanou frontou?"
        footer={<Button variant="primary" data-autofocus onClick={close}>Rozumím</Button>}>
        <p>Dialog nejde zavřít Escape ani klikem vedle – jen tlačítkem.</p>
      </Modal>
    </Stack>
  );
}

function LayoutSection() {
  return (
    <Stack as="section" gap={5}>
      <Paska>Rozvržení</Paska>
      <Split columns="320px minmax(0, 1fr)" gap={10}>
        <Panel as="aside" aria-label="Ukázka postranního panelu"><Paska as="h3">Filtry</Paska><p>Levý sloupec 320 px</p></Panel>
        <Panel><p>Pravý sloupec; pod 1024 px se složí pod levý.</p></Panel>
      </Split>
      <Grid columns={4} gap={4}>
        {[1, 2, 3, 4].map((n) => <Panel key={n} padding="lg"><p>Karta {n}</p></Panel>)}
      </Grid>
    </Stack>
  );
}

function NavSection() {
  const sections = [['Veřejný web', [...publicNav, publicLiveNav]], ['Administrace', adminNav], ['Časomíra', timekeeperNav]];
  return (
    <Stack as="section" gap={5}>
      <Paska>Navigace</Paska>
      <Grid columns={3} gap={4}>
        {sections.map(([name, items]) => (
          <Panel key={name}>
            <Paska as="h3">{name}</Paska>
            <Stack as="ul" gap={2}>
              {items.map((item) => (
                <li key={item.to}>
                  <Cluster gap={2}>
                    {item.icon && <Icon name={item.icon} size={18} />}
                    <span>{item.label}</span>
                    <code className={styles.code}>{item.to}</code>
                    {item.group === 'settings' && <Badge tone="neutral" size="sm">za oddělovačem</Badge>}
                  </Cluster>
                </li>
              ))}
            </Stack>
          </Panel>
        ))}
      </Grid>
    </Stack>
  );
}

function IconsSection() {
  const names = Object.keys(ICONS);
  const drawn = names.filter((name) => ICONS[name].drawn).length;
  return (
    <Stack as="section" gap={5}>
      <Paska aside={`${names.length} ikon · ${drawn} doplněných mimo artboardy`}>Ikony</Paska>
      <Grid min="132px" gap={3}>
        {names.map((name) => (
          <div key={name} className={styles.iconTile}>
            <Cluster gap={3}>
              <Icon name={name} size={24} />
              <Icon name={name} size={18} />
              <Icon name={name} size={16} />
            </Cluster>
            <code className={styles.code}>{name}</code>
            {ICONS[name].drawn && <Badge tone="dry" size="sm">nakresleno</Badge>}
          </div>
        ))}
      </Grid>
    </Stack>
  );
}
