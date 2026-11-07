// Popisky dokumentů z GET /documents.

/** Přípona souboru velkými písmeny („PDF“), nebo null. */
export const fileType = (document) => {
  const match = /\.([a-z0-9]{2,5})$/i.exec(document.original_filename || document.title || '');
  return match ? match[1].toUpperCase() : null;
};

/** Název bez přípony („Pokyny JMLP 26-27.pdf“ → „Pokyny JMLP 26-27“). */
export const documentName = (document) =>
  (document.title || '').replace(/\.[a-z0-9]{2,5}$/i, '').trim();

/** „2025/2026“ → „2025/26“ */
export const shortSeasonLabel = (season) =>
  `${season.season_year_start}/${String(season.season_year_end).slice(-2)}`;
