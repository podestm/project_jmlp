import { useId } from 'react';
import { Field, Icon, Input } from '../../../ms/index.js';
import styles from './SuggestField.module.css';

/**
 * Textové pole s nabídkou z číselníku (areál, pořadatel). Hodnota je volný
 * text – co v nabídce není, založí backend sám (find-or-create), proto ne
 * Combobox z kitu, který povolí jen hodnotu ze seznamu.
 */
export default function SuggestField({ label, hint, value, onChange, suggestions, onSelect, placeholder, icon = 'map-pin' }) {
  const listId = useId();
  return (
    <Field label={label} hint={hint} required>
      {(props) => (
        <span className={styles.wrap}>
          <Input
            {...props}
            size="sm"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            aria-controls={suggestions.length > 0 ? listId : undefined}
          />
          {suggestions.length > 0 && (
            <ul id={listId} className={styles.list} aria-label={`Nabídka – ${label}`}>
              {suggestions.map((item, index) => (
                <li key={`${item.name}-${index}`}>
                  <button type="button" className={styles.option} onClick={() => onSelect(item)}>
                    <Icon name={icon} size={16} />
                    <span className={styles.name}>{item.name}</span>
                    <span className={styles.note}>už v číselníku</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </span>
      )}
    </Field>
  );
}
