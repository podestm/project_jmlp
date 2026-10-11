import { useLayoutEffect } from 'react';
import { cx } from '../cx.js';
import styles from './Screen.module.css';

/**
 * Kořen převedené obrazovky veřejného webu: .ms-scope a světlé pozadí celé
 * stránky. Pozadí jde přes třídu body.ms-page (base.css), protože staré CSS
 * dává na <body> tmavou fotku (zmizí s ním ve Fázi 6). useLayoutEffect,
 * aby stránka neproblikla tmavě.
 */
export default function Screen({ className, children }) {
  useLayoutEffect(() => {
    document.body.classList.add('ms-page');
    return () => document.body.classList.remove('ms-page');
  }, []);
  return <div className={cx('ms-scope', styles.screen, className)}>{children}</div>;
}
