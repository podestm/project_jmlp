/**
 * Posuvné okno stran (AktualityArchiv): nejvýš `size` stran kolem aktuální,
 * u kraje se okno opře o první/poslední stranu.
 * pageWindow(1, 12) → [1, 2, 3, 4, 5]; pageWindow(7, 12) → [5, 6, 7, 8, 9]
 */
export const pageWindow = (page, pageCount, size = 5) => {
  if (pageCount <= 0) return [];
  const count = Math.min(size, pageCount);
  const start = Math.min(Math.max(1, page - Math.floor(count / 2)), pageCount - count + 1);
  return Array.from({ length: count }, (_, i) => start + i);
};
