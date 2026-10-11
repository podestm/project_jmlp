import { useCurrentSeason } from '../../hooks/useCurrentSeason.js';
import { EDITION_BASE_YEAR, formatSeasonShort, toRoman } from '../../utils/season.js';

export const CUP_NAME = 'Jihomoravský lyžařský pohár';

/**
 * Texty o aktuální sezóně do hlavičky, menu a patičky: ročník ('XX.'),
 * sezóna ('2026/27') a copyright ('© 2006–2026').
 * @param {{seasonId: number, edition: number}} current - z useCurrentSeason
 */
export const seasonInfo = ({ seasonId, edition }, date = new Date()) => ({
  edition: `${toRoman(edition)}.`,
  season: formatSeasonShort(seasonId),
  copyright: `© ${EDITION_BASE_YEAR}–${date.getFullYear()} ${CUP_NAME}`,
});

/** seasonInfo aktuální sezóny (volí ji správce ve správě sezón). */
export const useSeasonInfo = () => seasonInfo(useCurrentSeason());
