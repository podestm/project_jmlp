import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Odkaz s kotvou (/zavod/12#prihlaska, /kontakty#vybor) sjede po vykreslení
 * na prvek s daným id – router to při přechodu mezi stránkami sám neudělá.
 * @param {boolean} ready - obsah je vykreslený (např. data načtená)
 */
export function useScrollToHash(ready = true) {
  const { hash } = useLocation();
  useEffect(() => {
    if (!ready || !hash) return;
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'start' });
  }, [ready, hash]);
}
