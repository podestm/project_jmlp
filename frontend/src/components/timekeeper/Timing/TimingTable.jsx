import { ButtonLink, EmptyState, Icon, Table, VisuallyHidden } from '../../ms/index.js';
import TimingRow from './TimingRow.jsx';
import styles from './TimingTable.module.css';

/** Sdílená prázdná hodnota – nový objekt na řádek by rozbil memoizaci TimingRow. */
const EMPTY_TIMES = Object.freeze({});

const RoundHeader = ({ round, locked }) => (
  <th scope="col" className={locked ? styles.lockedHead : undefined}>
    {locked && <Icon name="lock" size={14} />}
    Kolo {round}
    {locked && <VisuallyHidden> – zamčeno</VisuallyHidden>}
  </th>
);

/**
 * Tabulka zadávání časů (TkZadavaniCasu).
 *
 * Řádek je memoizovaný v TimingRow.jsx, proto sem chodí handlery, které si
 * rodič drží v useCallback. Jakmile některý z nich začne měnit identitu,
 * memoizace přestane platit a startovka o 250 řádcích se překreslí při každé
 * stisknuté klávese.
 */
export default function TimingTable({
  entries,
  editedTimes,
  activeRound,
  hasWriteLock,
  showCategory,
  registerInput,
  onTimeChange,
  onKeyDown,
  onBlur,
  onToggleFlag,
  startListEmpty,
}) {
  if (entries.length === 0) {
    return startListEmpty ? (
      <EmptyState
        icon="list"
        title="Startovní listina je prázdná"
        action={<ButtonLink to="/timekeeper/start-list" size="sm" icon="list-numbered">Přejít na startovní listinu</ButtonLink>}
      />
    ) : (
      <EmptyState icon="filter" title="Ve vybraném filtru nikdo není" />
    );
  }

  return (
    // Bez TableScroll: tabulka se do 720 px vejde vždy (rámec má min. 768 px),
    // takže nevzniká posuvný box a hlavička s koly se lepí pod rámec stránky.
    <div className={styles.card}>
      <Table density="compact" stickyHeader className={styles.table}>
        <thead>
          <tr>
            <th scope="col" className={styles.narrow}>St.</th>
            <th scope="col" className={styles.narrow}>Dres</th>
            <th scope="col">Závodník</th>
            <RoundHeader round={1} locked={activeRound === '2'} />
            <RoundHeader round={2} locked={activeRound === '1'} />
            <th scope="col">Příznak</th>
            <th scope="col" data-align="end">Součet</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <TimingRow
              key={entry.id}
              entry={entry}
              times={editedTimes[entry.id] || EMPTY_TIMES}
              activeRound={activeRound}
              hasWriteLock={hasWriteLock}
              showCategory={showCategory}
              registerInput={registerInput}
              onTimeChange={onTimeChange}
              onKeyDown={onKeyDown}
              onBlur={onBlur}
              onToggleFlag={onToggleFlag}
            />
          ))}
        </tbody>
      </Table>
    </div>
  );
}
