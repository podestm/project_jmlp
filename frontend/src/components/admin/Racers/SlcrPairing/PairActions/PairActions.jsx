import { Button } from '../../../../ms/index.js';
import { cx } from '../../../../ms/cx.js';
import { PAIR_STATUS } from '../slcrPairing.js';
import styles from './PairActions.module.css';

const ACTIONS = {
  confirm: { label: 'Potvrdit', aria: 'Potvrdit párování', icon: 'check', className: styles.confirm },
  reject: { label: 'Odmítnout', aria: 'Odmítnout návrh', icon: 'close', className: styles.reject },
  undo: { label: 'Vrátit', aria: 'Vrátit rozhodnutí', icon: 'undo' },
};

/** Akce, které stav řádku dovoluje; nenalezení žádnou nemají. */
const actionsFor = (status) => {
  if (status === PAIR_STATUS.suggested) return ['confirm', 'reject'];
  if (status === PAIR_STATUS.confirmed || status === PAIR_STATUS.rejected) return ['undo'];
  return [];
};

/**
 * Tlačítka rozhodnutí u řádku. Během odeslání jsou obě vypnutá a stisknuté
 * ukazuje spinner (`busy` = právě odesílaná akce).
 */
export default function PairActions({ item, busy, onDecide, className }) {
  const actions = actionsFor(item.status);
  if (actions.length === 0) return null;
  const name = `${item.racer.surname} ${item.racer.name}`;
  return (
    <span className={cx(styles.actions, className)}>
      {actions.map((action) => {
        const def = ACTIONS[action];
        return (
          <Button
            key={action}
            size="sm"
            icon={def.icon}
            busy={busy === action}
            disabled={Boolean(busy)}
            aria-label={`${def.aria}: ${name}`}
            className={def.className}
            onClick={() => onDecide(item, action)}
          >
            {def.label}
          </Button>
        );
      })}
    </span>
  );
}
