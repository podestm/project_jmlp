import { EDITION_BASE_YEAR, formatSeasonShort, getCurrentSeasonId, seasonEdition, toRoman } from '../../utils/season.js';

export const CUP_NAME = 'Jihomoravský lyžařský pohár';

/**
 * Texty o aktuální sezóně do hlavičky, menu a patičky: ročník ('XX.'),
 * sezóna ('2026/27') a copyright ('© 2006–2026'). Počítá se z data stejně
 * jako ročník předvyplněný ve správě sezón.
 */
export const currentSeasonInfo = (date = new Date()) => {
  const seasonId = getCurrentSeasonId(date);
  return {
    edition: `${toRoman(seasonEdition(seasonId))}.`,
    season: formatSeasonShort(seasonId),
    copyright: `© ${EDITION_BASE_YEAR}–${date.getFullYear()} ${CUP_NAME}`,
  };
};
