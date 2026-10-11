import { LoadingState as MsLoadingState, Spinner } from '../ms/index.js';
import { cx } from '../ms/cx.js';
import styles from './LoadingState.module.css';

// Stará varianta „timekeeper“ (malý spinner v barvě časomíry) je v kitu inline.
const VARIANT = { page: 'page', fullscreen: 'fullscreen', inline: 'inline', timekeeper: 'inline' };

/**
 * Načítání pro obrazovky, které ještě nejsou převedené na Modrou stopu.
 * Vykreslí kit LoadingState (viditelný text v role="status"); kořen má
 * .ms-scope, aby ve starém okolí platil reset a písma nového UI. Ve starém
 * okolí stojí jako malá bílá karta na střed (jako dřív spinner), protože
 * pod ní může být tmavá fotka veřejného webu i světlá administrace.
 *
 * @param {'page'|'fullscreen'|'inline'|'timekeeper'} [variant]
 * @param {string} [label] - text načítání
 */
export default function LoadingState({ variant = 'page', label }) {
  return <MsLoadingState variant={VARIANT[variant] ?? 'page'} label={label} className={cx('ms-scope', styles.card, variant === 'fullscreen' && styles.fullscreen)} />;
}

/** Spinner uvnitř starého tlačítka, zatímco požadavek běží (místo ikony). */
export function ButtonSpinner() {
  return <Spinner size="1em" tone="current" className={styles.buttonSpinner} />;
}
