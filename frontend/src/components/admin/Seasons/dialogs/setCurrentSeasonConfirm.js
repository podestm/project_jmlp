/**
 * Dotaz pro useConfirm před změnou aktuální sezóny. Aktuální sezóna je
 * výchozí na webu (hlavička, kalendář, výsledky), ve filtrech administrace
 * i v časomíře, proto se mění jen s potvrzením.
 * @param {object} season - sezóna, která se stane aktuální
 * @param {object|undefined} current - dosud aktuální sezóna
 */
export const setCurrentSeasonConfirm = (season, current) => ({
  title: `Nastavit sezónu ${season.season_label} jako aktuální?`,
  message: [
    `Web, administrace i časomíra budou jako výchozí ukazovat sezónu ${season.season_label}`
      + `${season.edition_label ? ` (${season.edition_label} ročník)` : ''}.`,
    current && `Sezóna ${current.season_label} přestane být aktuální.`,
  ].filter(Boolean).join(' '),
  confirmLabel: 'Nastavit jako aktuální',
  icon: 'check',
});
