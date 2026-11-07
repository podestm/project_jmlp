import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isNavActive } from '../components/ms/navItems.js';
import { applyPageMeta } from '../seo/pageMeta.js';

/**
 * Titulek a meta značky stránky (seo/pageMeta.js). Volá ho každá obrazovka
 * se svým PAGE_META, detail závodu s raceMeta(race).
 * @param {{title: string, description?: string, noindex?: boolean}} meta
 */
export function usePageMeta({ title, description, noindex = false }) {
  useEffect(() => {
    applyPageMeta({ title, description, noindex }, window.location);
  }, [title, description, noindex]);
}

/**
 * Titulek obrazovky administrace nebo časomíry podle položky menu, která
 * odpovídá adrese („Závody · Administrace JMLP“). Sekce se neindexují.
 * @param {Array} nav - adminNav / timekeeperNav z ms/navItems.js
 * @param {(label?: string) => string} formatTitle - adminTitle / timekeeperTitle
 */
export function useSectionMeta(nav, formatTitle) {
  const { pathname } = useLocation();
  const item = nav.find((entry) => isNavActive(entry, pathname));
  usePageMeta({ title: formatTitle(item?.label), noindex: true });
}
