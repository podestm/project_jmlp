import { Button, Field, Input, Panel, Paska, Select } from '../../ms/index.js';
import styles from './News.module.css';

/**
 * Hledání v archivu (AktualityArchiv vlevo): text, rok, měsíc (jen po výběru
 * roku, nabízí jen měsíce s příspěvky), počet zobrazených a vymazání filtrů.
 */
export default function NewsFilters({ archive }) {
  const active = Boolean(archive.searchTerm || archive.selectedYear || archive.selectedMonth);
  return (
    <Panel as="aside" padding="md" className={styles.filters} aria-labelledby="hledat">
      <Paska id="hledat" as="h2">
        Hledat v archivu
      </Paska>
      <Field label="Hledat v příspěvcích">
        <Input
          type="search"
          placeholder="Např. Olešnice"
          value={archive.searchTerm}
          onChange={(event) => archive.setSearchTerm(event.target.value)}
        />
      </Field>
      <Field label="Rok">
        <Select
          value={archive.selectedYear}
          onChange={(event) => {
            archive.setSelectedYear(event.target.value);
            archive.setSelectedMonth('');
          }}
        >
          <option value="">Všechny roky</option>
          {archive.getAvailableYears().map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Měsíc">
        <Select
          value={archive.selectedMonth}
          disabled={!archive.selectedYear}
          onChange={(event) => archive.setSelectedMonth(event.target.value)}
        >
          <option value="">
            {archive.selectedYear ? 'Všechny měsíce' : 'Nejdřív vyberte rok'}
          </option>
          {archive.getAvailableMonths().map((month) => (
            <option key={month} value={String(month).padStart(2, '0')}>
              {archive.monthNames[month]}
            </option>
          ))}
        </Select>
      </Field>
      <p className={styles.count} aria-live="polite">
        Zobrazeno <strong>{archive.filteredPosts.length}</strong> z{' '}
        <strong>{archive.posts.length}</strong> příspěvků
      </p>
      {active && (
        <Button size="sm" icon="close" block onClick={archive.clearFilters}>
          Vymazat filtry
        </Button>
      )}
    </Panel>
  );
}
