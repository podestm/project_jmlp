import { useEffect } from 'react';

/**
 * Když se taby nevejdou a lišta se posouvá (pod 768 px), posune ji tak,
 * aby byl aktivní tab vidět (uprostřed). Posouvá jen lištu, ne stránku.
 */
export function useActiveTabInView(navRef, pathname) {
  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector('[aria-current="page"]');
    if (!active || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
  }, [navRef, pathname]);
}
