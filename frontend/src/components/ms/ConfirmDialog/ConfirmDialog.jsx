import Button from '../Button/Button.jsx';
import Modal from '../Modal/Modal.jsx';

/**
 * Potvrzovací dialog (DialogPotvrzeni) nad kit Modal. Volá ho useConfirm
 * (hooks/useConfirm.jsx) a dialogy, které potřebují vlastní tělo.
 *
 * @param {string} title - otázka, která jmenuje co („Smazat závod …?“)
 * @param {React.ReactNode} message - řetězec se vykreslí jako odstavec
 * @param {Array<{value: *, label: string, danger?: boolean, icon?: string, hint?: string,
 *   disabled?: boolean}>} choices
 *   Tlačítka vedle Zrušit. Jedna volba je obvyklé potvrzení, víc voleb
 *   nahrazuje dotaz s volným textem. Volba je zamčená (disabled), dokud tělo
 *   dialogu čeká na odpověď – smazání klubu čeká na výběr cílového klubu.
 *   danger: nebezpečná volba (mazání, přepsání); icon je název
 *   z components/ms/Icon/icons.js.
 * @param {string} [cancelLabel]
 * @param {function} onResolve - zvolená hodnota, nebo null při zrušení
 *   (Zrušit, křížek, Escape, klik do překryvu)
 *
 * Fokus (a tedy Enter) dostane první volba, která není nebezpečná ani zamčená;
 * když taková není, dostane ho Zrušit. Enter se mačká ze zvyku, zvlášť
 * v časomíře při zápisu časů, a jeden stisk nesmí nic smazat ani přepsat.
 *
 * Pořadí tlačítek podle artboardu: hlavní akce úplně vpravo (bezpečná volba
 * s fokusem, jinak poslední volba), Zrušit hned vlevo od ní, další běžné
 * volby před Zrušit a další nebezpečné volby zvlášť na levém okraji. Plná
 * je jen hlavní bezpečná akce; nebezpečná je vždy obrys v barvě chyby.
 */
export default function ConfirmDialog({
  title,
  message,
  choices,
  cancelLabel = 'Zrušit',
  onResolve,
}) {
  const focusIndex = choices.findIndex((choice) => !choice.disabled && !choice.danger);
  const mainIndex = focusIndex >= 0 ? focusIndex : choices.length - 1;

  const renderChoice = (choice, index) => {
    const dangerous = Boolean(choice.danger);
    return (
      <Button
        key={String(choice.value)}
        variant={dangerous ? 'danger' : index === mainIndex ? 'primary' : 'outline'}
        icon={choice.icon}
        disabled={choice.disabled}
        title={choice.hint}
        data-autofocus={index === focusIndex || undefined}
        onClick={() => onResolve(choice.value)}
      >
        {choice.label}
      </Button>
    );
  };

  const others = choices
    .map((choice, index) => ({ choice, index }))
    .filter(({ index }) => index !== mainIndex);
  const dangerousOthers = others.filter(({ choice }) => choice.danger);
  const safeOthers = others.filter(({ choice }) => !choice.danger);

  return (
    <Modal
      open
      title={title}
      onClose={() => onResolve(null)}
      footerStart={
        dangerousOthers.length > 0 &&
        dangerousOthers.map(({ choice, index }) => renderChoice(choice, index))
      }
      footer={
        <>
          {safeOthers.map(({ choice, index }) => renderChoice(choice, index))}
          <Button data-cancel onClick={() => onResolve(null)}>
            {cancelLabel}
          </Button>
          {choices[mainIndex] && renderChoice(choices[mainIndex], mainIndex)}
        </>
      }
    >
      {typeof message === 'string' ? <p>{message}</p> : message}
    </Modal>
  );
}
