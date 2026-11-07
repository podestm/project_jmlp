import {
  Button,
  ButtonLink,
  EmptyState,
  LoadingState,
  PageHeader,
  Split,
  Table,
  TableScroll,
} from '../../ms/index.js';
import NoRaceSelected from '../frame/NoRaceSelected/NoRaceSelected.jsx';
import { useSelectedRaceId } from '../frame/selectedRace.js';
import TkPage from '../frame/TkPage/TkPage.jsx';
import TimekeeperMessage from '../TimekeeperMessage.jsx';
import AddRacerForm from './AddRacerForm.jsx';
import RacerEditRow from './RacerEditRow.jsx';
import RacerFilters from './RacerFilters.jsx';
import RacerRow from './RacerRow.jsx';
import { isFiltered } from './racers.js';
import { useTimekeeperRacers } from './useTimekeeperRacers.js';
import styles from './TimekeeperRacers.module.css';

const COLUMNS = ['Poř.', 'Dres', 'Závodník a oddíl', 'Ročník', 'Pohlaví', 'Kategorie', 'Řádek'];

/**
 * Závodníci závodu (TkZavodnici): vlevo dopsání závodníka přímo k trati,
 * vpravo filtry a tabulka s opravou řádku. Do registrací se nezapisuje.
 * Logika je v useTimekeeperRacers.
 */
export default function TimekeeperRacers() {
  // Závod se vybírá v Přehledu, tady se jen čte.
  const raceId = useSelectedRaceId();
  const racers = useTimekeeperRacers(raceId);
  const {
    startList,
    loading,
    message,
    clearMessage,
    filters,
    setFilter,
    resetFilters,
    clubOptions,
    categoryOptions,
    filteredEntries,
    editingId,
    editForm,
    updateEditField,
    startEditing,
    cancelEditing,
    saveEditing,
    editError,
    categoryPreview,
  } = racers;

  const table = () => {
    if (loading) return <LoadingState label="Načítám závodníky závodu…" />;
    if (filteredEntries.length === 0) {
      return (
        <EmptyState
          icon="search"
          title="Žádní závodníci neodpovídají aktuálním filtrům."
          action={
            isFiltered(filters) && (
              <Button size="sm" onClick={resetFilters}>
                Zrušit filtry
              </Button>
            )
          }
        />
      );
    }
    return (
      <TableScroll label="Závodníci závodu">
        <Table density="compact" caption="Závodníci závodu, řazení podle startovní listiny">
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th key={column} scope="col" data-align={column === 'Řádek' ? 'end' : undefined}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredEntries.map((entry) =>
              editingId === entry.id ? (
                <RacerEditRow
                  key={entry.id}
                  entry={entry}
                  colSpan={COLUMNS.length}
                  editForm={editForm}
                  updateEditField={updateEditField}
                  error={editError}
                  categoryPreview={categoryPreview}
                  onSave={saveEditing}
                  onCancel={cancelEditing}
                />
              ) : (
                <RacerRow key={entry.id} entry={entry} onEdit={startEditing} />
              ),
            )}
          </tbody>
        </Table>
      </TableScroll>
    );
  };

  return (
    <TkPage>
      <PageHeader
        variant="app"
        title="Závodníci závodu"
        actions={
          raceId && (
            <ButtonLink to="/timekeeper/start-list" size="sm" icon="list">
              Na startovní listinu
            </ButtonLink>
          )
        }
      />

      <TimekeeperMessage message={message} onDismiss={clearMessage} />

      {raceId ? (
        <Split columns="minmax(340px, 400px) minmax(0, 1fr)" gap={5} stackBelow={1280}>
          <AddRacerForm racers={racers} />
          <div className={styles.list}>
            <RacerFilters
              filters={filters}
              setFilter={setFilter}
              clubOptions={clubOptions}
              categoryOptions={categoryOptions}
              shown={filteredEntries.length}
              total={startList.length}
            />
            {table()}
          </div>
        </Split>
      ) : (
        <NoRaceSelected />
      )}
    </TkPage>
  );
}
