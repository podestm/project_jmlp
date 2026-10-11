import { Button, Input, Select } from '../../../../ms/index.js';
import styles from './PairFilters.module.css';

/**
 * Hledání nad řádky záložky; u „K potvrzení“ navíc jistota shody a hromadné
 * potvrzení jistých shod (během něj „Potvrzuji X z Y“).
 */
export default function PairFilters({
  query, onQueryChange, showSuggestedTools, confidence, onConfidenceChange, confirmableCount, bulk, onConfirmAll,
}) {
  return (
    <div className={styles.filters}>
      <Input
        size="sm"
        type="search"
        placeholder="Hledat jméno nebo ID…"
        aria-label="Hledat jméno nebo ID"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        className={styles.search}
      />
      {showSuggestedTools && (
        <>
          <Select
            size="sm"
            value={confidence}
            onChange={(event) => onConfidenceChange(event.target.value)}
            aria-label="Jistota shody"
            className={styles.confidence}
          >
            <option value="all">Všechny shody</option>
            <option value="high">Jisté shody</option>
            <option value="medium">Pravděpodobné</option>
            <option value="low">Nejisté</option>
          </Select>
          <Button
            size="sm"
            icon="check-double"
            busy={bulk != null}
            disabled={confirmableCount === 0}
            title="Jen jisté shody bez jakéhokoli upozornění"
            onClick={onConfirmAll}
            className={styles.confirmAll}
          >
            {bulk
              ? <>Potvrzuji <span className={styles.num}>{bulk.done}</span> z <span className={styles.num}>{bulk.total}</span></>
              : <>Potvrdit jisté (<span className={styles.num}>{confirmableCount}</span>)</>}
          </Button>
        </>
      )}
    </div>
  );
}
