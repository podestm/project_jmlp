// České názvy dnů a měsíců pro BibDate. Zkratky podle artboardů (so, říj).
const DAYS = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
const DAYS_SHORT = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'];
const MONTHS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
const MONTHS_SHORT = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];
const MONTHS_GENITIVE = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];

/** Datum z Date nebo ISO řetězce; 'YYYY-MM-DD' se bere jako místní den (ne UTC). */
export const toDate = (value) => {
  if (value instanceof Date) return value;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value);
};

/** Části data pro vykreslení startovního čísla. */
export const czechDateParts = (value) => {
  const date = toDate(value);
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();
  return {
    iso: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    day: String(day).padStart(2, '0'),
    weekday: DAYS[date.getDay()],
    weekdayShort: DAYS_SHORT[date.getDay()],
    month: MONTHS[month],
    monthShort: MONTHS_SHORT[month],
    yearShort: String(year).slice(-2),
    // Pro čtečku: „sobota 3. října 2026“.
    spoken: `${DAYS[date.getDay()]} ${day}. ${MONTHS_GENITIVE[month]} ${year}`,
  };
};
