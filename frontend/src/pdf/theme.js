/**
 * Vzhled výsledkové listiny.
 *
 * Barvy a šířky sloupců jsou tady pojmenované, aby doladění podle papírové
 * předlohy byla jednořádková změna.
 */

export const COLORS = {
  bandBackground: '#B8CCE4',   // světle modrý pás hlavičky
  titleRule: '#FFFF00',        // žluté linky kolem velkého nadpisu
  valueText: '#0000CC',        // modré tučné hodnoty v rámečcích
  categoryBackground: '#DCE6F1',
  grid: '#808080',
  text: '#000000',
  muted: '#666666'
};

export const FONT_SIZES = {
  title: 18,
  bigTitle: 22,
  label: 8,
  value: 10,
  tableHeader: 8,
  cell: 8,
  cellSmall: 7.5,
  footer: 6
};

/**
 * Šířky sloupců v bodech.
 *
 * A4 na výšku (595 b) minus okraje 34+34 dává 527 b využitelné šířky.
 * Pozor: pdfmake k šířce každého sloupce přičítá vodorovný padding, takže
 * součet šířek musí být o (počet sloupců × 2 × CELL_PADDING_X) menší.
 * Bez toho tabulka přetekla a poslední sloupec (PT) se vůbec nevykreslil.
 *
 * Pořadí | Jméno | st.č. | ročník | Startuje za | Stát | 1.kolo | [2.kolo] | Součet | DIF | PT
 */
export const CELL_PADDING_X = 2;

//                                 Poř  Jméno st.č roč  Klub  Stát 1.k  Souč DIF  PT   = 487
export const COLUMNS_ONE_RUN = [30, 115, 26, 30, 110, 26, 42, 44, 40, 24];
//                                 Poř  Jméno st.č roč  Klub  Stát 1.k  2.k  Souč DIF  PT = 475
export const COLUMNS_TWO_RUNS = [28, 100, 24, 28, 95, 24, 38, 38, 40, 38, 22];

export const PAGE_MARGINS = [34, 28, 34, 34]; // vlevo, nahoře, vpravo, dole

/** Čas s desetinnou čárkou: 30,27 */
export const formatTime = (value) =>
  value == null ? '' : value.toFixed(2).replace('.', ',');

/** Ztráta na vítěze: +2,10 */
export const formatDiff = (value) =>
  value == null ? '' : `+${value.toFixed(2).replace('.', ',')}`;

/** Datum do hlavičky: 07.02.26 */
export const formatHeaderDate = (isoDate) => {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${String(date.getFullYear()).slice(-2)}`;
};

/**
 * Popisek a modrá tučná hodnota v hlavičce.
 *
 * Hodnota je jen podtržená, ne orámovaná - v celé listině nejsou žádné svislé
 * linky a vodorovné oddělují jen sekce.
 */
export const labelValueRow = (label, value, valueWidth = 200) => ({
  columns: [
    {
      text: label,
      bold: true,
      fontSize: FONT_SIZES.label,
      alignment: 'right',
      width: 150,
      margin: [0, 3, 6, 0]
    },
    {
      table: {
        widths: [valueWidth],
        body: [[{
          text: value || ' ',
          bold: true,
          color: COLORS.valueText,
          fontSize: FONT_SIZES.value,
          alignment: 'center',
          margin: [2, 1, 2, 2]
        }]]
      },
      layout: {
        hLineWidth: (i) => (i === 1 ? 0.5 : 0),   // jen podtržení
        vLineWidth: () => 0,
        hLineColor: () => COLORS.grid
      },
      width: 'auto'
    }
  ],
  margin: [0, 1, 0, 1]
});

/**
 * Sazba tabulky výsledků.
 *
 * Žádné svislé linky a žádné linky mezi řádky - sloupce drží zarovnání samo.
 * Vodorovné linky jen tam, kde oddělují sekci:
 *   - dvojlinka pod hlavičkou sloupců (silná + tenká)
 *   - tenká linka na konci bloku kategorie
 *
 * Dvojlinka vzniká prázdným distančním řádkem hned za hlavičkou, protože
 * pdfmake umí na jedné hraně vykreslit jen jednu čáru.
 */
export const RULE_DOUBLE_TOP = 1.1;
export const RULE_DOUBLE_BOTTOM = 0.4;
export const RULE_SECTION_END = 0.6;

export const tableLayout = {
  hLineWidth: (i, node) => {
    if (i === 1) return RULE_DOUBLE_TOP;       // pod hlavičkou sloupců
    if (i === 2) return RULE_DOUBLE_BOTTOM;    // druhá čára dvojlinky
    if (i === node.table.body.length) return RULE_SECTION_END;
    return 0;
  },
  vLineWidth: () => 0,
  hLineColor: () => COLORS.text,
  // Distanční řádek dvojlinky musí být co nejtenčí, jinak jsou čáry daleko od sebe.
  paddingTop: (i) => (i === 1 ? 0 : 2),
  paddingBottom: (i) => (i === 1 ? 0 : 2),
  paddingLeft: () => CELL_PADDING_X,
  paddingRight: () => CELL_PADDING_X
};
