import { formatSystemRaceNumber, getRaceNumberBadgeStyle } from '../../utils/raceNumbers.js';

export default function RaceNumberBadge({
  actualNumber,
  displayNumber,
  setColor,
  smallTopMargin = true,
}) {
  if (actualNumber == null && displayNumber == null) {
    return '—';
  }

  return (
    <>
      <span className="badge" style={getRaceNumberBadgeStyle(setColor)}>
        {actualNumber ?? displayNumber}
      </span>
      <small className={`text-muted d-block text-nowrap${smallTopMargin ? ' mt-1' : ' mt-0'}`}>
        {formatSystemRaceNumber(displayNumber)}
      </small>
    </>
  );
}