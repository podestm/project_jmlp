import { formatSystemRaceNumber, getRaceNumberBadgeStyle } from '../../utils/raceNumbers.js';

/**
 * Číslo dresu v barvě sady. Systémové označení (B12) se nevypisuje - sadu
 * pozná obsluha podle barvy; označení je jen v bublině po najetí myší.
 */
export default function RaceNumberBadge({
  actualNumber,
  displayNumber,
  setColor,
}) {
  if (actualNumber == null && displayNumber == null) {
    return '—';
  }

  const code = formatSystemRaceNumber(displayNumber);
  return (
    <span className="badge" style={getRaceNumberBadgeStyle(setColor)} title={code || undefined}>
      {actualNumber ?? displayNumber}
    </span>
  );
}
