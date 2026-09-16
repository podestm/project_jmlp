import { useLayoutEffect } from 'react';

/**
 * Přidá třídu na <body>, dokud je komponenta připojená.
 *
 * Administrace a časoměřič tím zapínají své světlé téma (admin.css,
 * `.theme-backoffice`). Třída musí být až na <body>, ne na obalovém divu
 * stránky: modální okna, výběr z knihovny i rozbalovací seznamy
 * SearchableSelect se vykreslují mimo obal a dřív proto dostávaly tmavé barvy
 * veřejného webu - světlý text na bílém.
 *
 * useLayoutEffect, aby se třída nastavila před prvním vykreslením a stránka
 * neproblikla v cizích barvách.
 */
export function useBodyClass(className) {
  useLayoutEffect(() => {
    document.body.classList.add(className);
    return () => document.body.classList.remove(className);
  }, [className]);
}

export default useBodyClass;
