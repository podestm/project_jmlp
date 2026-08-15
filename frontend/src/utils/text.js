// Práce s textem z databáze.

// Znaky, které vznikají, když se UTF-8 bajty přečtou jako Latin-1. Bez nich
// bychom převod pouštěli na každý řetězec a poškodili i text, který je v pořádku.
const MOJIBAKE_MARKERS = /[ÃÂÅÄ]/;

const toLatin1Bytes = (text) => {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    // Nad 255 se do jednoho bajtu nevejde, takže to dvojité kódování není.
    if (code > 255) return null;
    bytes[i] = code;
  }
  return bytes;
};

/**
 * Opraví česká písmena ve starých záznamech, kde je UTF-8 uložené dvakrát
 * ("PetrÅ¯v" -> "Petrův").
 *
 * Dělá totéž co fix_encoding v backend/app/utils.py: zkusí text přečíst zpátky
 * jako bajty a dekódovat je jako UTF-8. Dřív tu byla ruční tabulka náhrad, jenže
 * měla duplicitní klíče ('Ä' tam byl třikrát), takže z ní v objektu přežil vždy
 * jen ten poslední - převod na č, ď, ň a ř se tiše ztrácel a každé samostatné
 * Å nebo Ä v cizím jméně se přepsalo na český znak.
 *
 * @param {string} text
 * @returns {string} opravený text, nebo původní když opravit nejde
 */
export const fixEncoding = (text) => {
  if (!text || !MOJIBAKE_MARKERS.test(text)) return text;

  const bytes = toLatin1Bytes(text);
  if (!bytes) return text;

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    // Nebylo to dvojité kódování, jen text s písmenem Å nebo Ä.
    return text;
  }
};

// Uživatelský text se před markdown úpravami escapuje, aby byl výstup bezpečný
// pro dangerouslySetInnerHTML.
const escapeHtml = (text) => text
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#x27;');

/**
 * Jednoduché formátování textu příspěvků.
 * @param {string} text
 * @returns {string} HTML; obsah je escapovaný a značky vzniknou jen z **tučně**,
 *   *kurzíva* a konců řádků
 */
export const formatText = (text) => {
  if (!text) return '';

  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
};
