/**
 * Dotaz pro useConfirm před změnou aktuální sezóny. Aktuální sezóna je
 * výchozí na webu (hlavička, kalendář, výsledky), ve filtrech administrace
 * i v časomíře, proto se mění jen s potvrzením.
 * @param {object} season - sezóna, která se stane aktuální
 * @param {object|undefined} current - dosud aktuální sezóna
 */
export const setCurrentSeasonConfirm = (season, current) => ({
  title: `Nastavit sezónu ${season.season_label} jako aktuální?`,
  message: current
    ? `Sezóna ${current.season_label} přestane být aktuální.`
    : 'Bude výchozí na webu, v administraci i v časomíře.',
  confirmLabel: 'Nastavit jako aktuální',
  icon: 'check',
});
