import { Button, Field, Input, Select } from '../../../ms/index.js';
import { shownSummary } from '../posts.js';
import styles from './PostFilters.module.css';

/** Hledání, stav, rok a měsíc nad seznamem příspěvků (AdminPrispevky). */
export default function PostFilters({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  selectedYear,
  setSelectedYear,
  selectedMonth,
  setSelectedMonth,
  availableYears,
  availableMonths,
  monthNames,
  clearFilters,
  shown,
  total,
}) {
  return (
    <div className={styles.filters}>
      <Field label="Hledat v příspěvcích" className={styles.search}>
        <Input
          type="search"
          size="sm"
          placeholder="Nadpis nebo text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </Field>
      <Field label="Stav" className={styles.select}>
        <Select size="sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Všechny stavy</option>
          <option value="published">Publikované</option>
          <option value="draft">Koncepty</option>
        </Select>
      </Field>
      <Field label="Rok" className={styles.select}>
        <Select size="sm" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
          <option value="">Všechny roky</option>
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Měsíc" className={styles.select}>
        <Select
          size="sm"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          disabled={!selectedYear}
        >
          <option value="">{selectedYear ? 'Všechny měsíce' : 'Nejdřív vyberte rok'}</option>
          {availableMonths.map((month) => (
            <option key={month} value={month.toString().padStart(2, '0')}>
              {monthNames[month - 1]}
            </option>
          ))}
        </Select>
      </Field>
      <Button size="sm" onClick={clearFilters} className={styles.reset}>
        Vymazat filtry
      </Button>
      <p className={styles.summary} aria-live="polite">
        {shownSummary(shown, total)}
      </p>
    </div>
  );
}
