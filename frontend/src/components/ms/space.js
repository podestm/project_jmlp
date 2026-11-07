// Mezery kitu jsou jen kroky škály --ms-space-N (N × 4 px) z tokens.css.
export const SPACE_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14];

/** CSS hodnota pro krok mezery; neznámý krok je chyba (v dev výjimka). */
export const spaceVar = (step) => {
  if (!SPACE_STEPS.includes(step)) {
    if (import.meta.env.DEV)
      throw new Error(`Neznámý krok mezery ${step} (povolené: ${SPACE_STEPS.join(', ')})`);
    return undefined;
  }
  return `var(--ms-space-${step})`;
};

/** Inline styl jen s custom property mezery (povoleno pravidly check:styles). */
export const gapStyle = (step, name = '--gap') => ({ [name]: spaceVar(step) });
