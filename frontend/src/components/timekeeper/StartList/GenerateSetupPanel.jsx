import { Button, CloseButton, Icon, IconButton, LoadingState, Tooltip } from '../../ms/index.js';
import { categoryLabel } from '../startListHelpers.js';
import styles from './GenerateSetupPanel.module.css';

/**
 * Generování listiny z přihlášek (TkStartovniListina, pravý panel): pořadí
 * kategorií na startu – přetažením nebo šipkami – a Vygenerovat.
 */
export default function GenerateSetupPanel({ setup }) {
  const {
    orderedCategories,
    loadingSetup,
    generating,
    generate,
    closeSetup,
    drag,
    moveUp,
    moveDown,
  } = setup;
  const last = orderedCategories.length - 1;

  return (
    <aside className={styles.panel} aria-labelledby="generovani-listiny">
      <header className={styles.head}>
        <Icon name="list" size={20} />
        <h2 id="generovani-listiny" className={styles.title}>
          Generování listiny
        </h2>
        <CloseButton label="Zavřít generování" onClick={closeSetup} />
      </header>

      {loadingSetup ? (
        <LoadingState variant="inline" label="Načítám nastavení…" />
      ) : (
        <div className={styles.body}>
          <span className={styles.caps}>Pořadí kategorií na startu</span>
          <ol className={styles.list}>
            {orderedCategories.map((category, index) => (
              <li
                key={category.id}
                draggable
                onDragStart={() => drag.handleDragStart(index)}
                onDragEnter={() => drag.handleDragEnter(index)}
                onDragEnd={drag.handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                className={styles.item}
              >
                <Icon name="grip" size={18} className={styles.grip} />
                <span className={styles.order}>{index + 1}</span>
                <span className={styles.name}>{categoryLabel(category)}</span>
                {category.code && (
                  <span className={styles.code} title="Kódové označení kategorie">
                    {category.code}
                  </span>
                )}
                <span className={styles.sex}>{category.sex === 2 ? 'ženy' : 'muži'}</span>
                <IconButton
                  icon="chevron-up"
                  label={`Posunout ${categoryLabel(category)} nahoru`}
                  disabled={index === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    moveUp(index);
                  }}
                />
                <IconButton
                  icon="chevron-down"
                  label={`Posunout ${categoryLabel(category)} dolů`}
                  disabled={index === last}
                  onClick={(e) => {
                    e.stopPropagation();
                    moveDown(index);
                  }}
                />
              </li>
            ))}
          </ol>
          <div className={styles.actions}>
            <Tooltip text="Přidá jen chybějící přihlášené" className={styles.generate}>
              <Button variant="primary" icon="lightning" busy={generating} onClick={generate}>
                {generating ? 'Generuji…' : 'Vygenerovat listinu'}
              </Button>
            </Tooltip>
            <Button data-cancel onClick={closeSetup}>
              Zrušit
            </Button>
          </div>
        </div>
      )}
    </aside>
  );
}
