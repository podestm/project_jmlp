import { Alert } from '../../ms/index.js';

/** Tělo dialogu „Převzít časomíru z druhé karty?“ (TkDialogPrevzitCasomiru). */
export default function TakeOverMessage() {
  return (
    <>
      <p>Druhá karta časomíru odpojí a přepne se jen na čtení.</p>
      <Alert type="warning" compact title="Rozepsaný čas v druhé kartě nejdřív uložte" />
    </>
  );
}

/** Volby pro useConfirm: převzetí je běžná (ne nebezpečná) akce, Enter ji potvrdí. */
export const TAKE_OVER_CONFIRM = {
  title: 'Převzít časomíru z druhé karty?',
  message: <TakeOverMessage />,
  confirmLabel: 'Převzít časomíru',
  icon: 'plug',
};
