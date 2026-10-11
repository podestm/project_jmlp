import { ButtonLink, Container, EmptyState, PageHeader, Screen, Stack } from '../../ms/index.js';
import { currentSeasonInfo } from '../../site/siteInfo.js';
import styles from './Results.module.css';

/**
 * Výsledky a pořadí (/vysledky). Zatím jen poctivý prázdný stav – přehled
 * výsledků a celkové pořadí poháru přijde ve Fázi 3 (Vysledky.dc.html).
 */
export default function Results() {
  const { edition, season } = currentSeasonInfo();
  return (
    <Screen>
      <Container className={styles.page}>
        <Stack gap={8}>
          <PageHeader eyebrow={`Sezóna ${season} · ${edition} ročník`} title="Výsledky a pořadí" />
          <EmptyState
            size="lg"
            icon="trophy"
            title="Přehled výsledků se připravuje"
            hint="Celkové pořadí poháru tu brzy bude. Výsledkové listiny jednotlivých závodů zatím najdete v kalendáři u každého závodu."
            action={<ButtonLink to="/zavody" variant="primary" iconEnd="arrow-right">Kalendář závodů</ButtonLink>}
          />
        </Stack>
      </Container>
    </Screen>
  );
}
