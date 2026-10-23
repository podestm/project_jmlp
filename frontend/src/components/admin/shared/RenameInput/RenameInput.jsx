import { Input } from '../../../ms/index.js';
import styles from './RenameInput.module.css';

/**
 * Pole pro nový název souboru přímo v řádku (knihovna, přílohy): Enter
 * a opuštění pole uloží (onCommit), Escape zruší (onCancel).
 */
export default function RenameInput({ value, onChange, onCommit, onCancel }) {
  return (
    <span className={styles.rename}>
      <Input
        size="sm"
        value={value}
        autoFocus
        aria-label="Nový název souboru"
        className={styles.input}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCommit();
          if (e.key === 'Escape') onCancel();
        }}
      />
    </span>
  );
}
