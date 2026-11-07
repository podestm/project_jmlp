// Popis závodu sdílený obrazovkami administrace (Závody, Přihlášky).

/** race_method_id 2 = suchý slalom, cokoli jiného = závod na sněhu (výchozí). */
export const methodLabel = (race) => (race.race_method_id === 2 ? 'suchý slalom' : 'závod na sněhu');

/** „FreeSki Academy Brno · suchý slalom“ – druhý řádek u názvu závodu. */
export const raceSubtitle = (race) => [race.organizer_name, methodLabel(race)].filter(Boolean).join(' · ');
