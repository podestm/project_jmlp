import { forwardRef, useId, useMemo, useRef, useState } from 'react';
import { cx } from '../cx.js';
import Icon from '../Icon/Icon.jsx';
import { filterOptions } from './combobox.js';
import styles from './Combobox.module.css';

/**
 * Výběr ze seznamu s hledáním (PrihlaskaHledani „Výběr klubu“): textové pole,
 * pod ním rozbalený seznam (ARIA 1.2 combobox + listbox, bez portálu – smí
 * tedy i do Modal). Šipky nahoru/dolů procházejí volby, Enter vybere,
 * Escape zavře. Atributy od Field (id, aria-invalid, aria-describedby,
 * required) jdou na textové pole.
 * - options: [{ value, label }], value: vybraná hodnota nebo null
 * - onChange(value | null): křížek „Zrušit výběr“ pošle null
 * - noMatchText(query): věta, když nic neodpovídá
 * - footer: řádek pod seznamem (např. „Můj klub tu není – napíšu ho ručně“)
 * - size: lg 52 px (veřejný formulář) | sm 44 px (filtry administrace, AdminDialogVyberKlubu)
 */
const Combobox = forwardRef(function Combobox({
  options, value, onChange, placeholder, noMatchText = () => 'Nic neodpovídá hledání.', footer,
  clearLabel = 'Zrušit výběr', toggleLabel = 'Zobrazit seznam', disabled = false, size = 'lg', className, ...inputProps
}, ref) {
  const listId = useId();
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const selected = options.find((option) => option.value === value) ?? null;
  const visible = useMemo(() => filterOptions(options, query), [options, query]);

  const openList = () => { setOpen(true); setActive(0); };
  const close = () => { setOpen(false); setQuery(''); };
  const choose = (option) => { onChange(option.value); close(); };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) { openList(); return; }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((index) => Math.min(Math.max(index + step, 0), Math.max(visible.length - 1, 0)));
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      if (visible[active]) choose(visible[active]);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      close();
    }
  };

  // Fokus odešel mimo pole i seznam → zavřít (klik do seznamu fokus neodnese, viz onMouseDown).
  const onBlur = (event) => {
    if (!wrapRef.current?.contains(event.relatedTarget)) close();
  };

  const activeId = open && visible[active] ? `${listId}-${active}` : undefined;

  return (
    <div ref={wrapRef} className={cx(styles.combobox, className)} onBlur={onBlur}>
      <span className={cx(styles.field, styles[size])}>
        <Icon name="search" size={18} className={styles.searchIcon} />
        <input
          ref={ref}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          className={styles.input}
          placeholder={placeholder}
          disabled={disabled}
          value={open ? query : (selected?.label ?? '')}
          onFocus={() => { if (!open) openList(); }}
          onClick={() => { if (!open) openList(); }}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(0); }}
          onKeyDown={onKeyDown}
          {...inputProps}
        />
        {selected && !disabled && (
          <button type="button" className={styles.iconButton} aria-label={clearLabel} onClick={() => { onChange(null); close(); }}>
            <Icon name="close" size={18} />
          </button>
        )}
        <button
          type="button"
          tabIndex={-1}
          className={styles.iconButton}
          aria-label={toggleLabel}
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => (open ? close() : openList())}
        >
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} />
        </button>
      </span>
      {open && (
        <div className={styles.popover}>
          <ul id={listId} role="listbox" className={styles.list} aria-label={placeholder}>
            {visible.map((option, index) => (
              <li
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option.value === value}
                data-active={index === active || undefined}
                className={styles.option}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option)}
              >
                <span>{option.label}</span>
                {option.value === value && <Icon name="check" size={16} />}
              </li>
            ))}
          </ul>
          {visible.length === 0 && <p className={styles.noMatch}>{noMatchText(query)}</p>}
          {footer && <div className={styles.footer}>{footer}</div>}
        </div>
      )}
    </div>
  );
});

export default Combobox;
