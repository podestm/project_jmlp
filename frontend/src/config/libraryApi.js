/**
 * Knihovna dokumentů - plochý seznam souborů s filtry.
 *
 * Složky a sezóny jako úrovně stromu skončily: kam soubor patří, určuje
 * příloha (kam je připojený) a jeho systematický název. Knihovna proto jen
 * filtruje jednu tabulku, přejmenovává, maže a exportuje.
 */
import { AdminAPI, adminAuthHeaders, fetchBlob } from './api.js';

/** Nabídka filtru „kde je soubor použitý" - hodnoty musí sedět na AttachmentOwner. */
export const OWNER_FILTERS = [
  { value: '', label: 'Kdekoli' },
  { value: 'race', label: 'Závod' },
  { value: 'season', label: 'Sezóna' },
  { value: 'post', label: 'Článek' },
  { value: 'club', label: 'Klub' },
  { value: 'library', label: 'Nikde nepoužité' }
];

/**
 * Prázdné filtry musí z dotazu zmizet úplně.
 *
 * `buildUrl` zahazuje jen null/undefined, takže `owner_type=` by doletělo na
 * backend jako prázdný řetězec a ten by filtroval na "" - výsledkem je prázdný
 * seznam místo všech souborů.
 */
const cleanParams = (filters = {}) => Object.fromEntries(
  Object.entries(filters).filter(([, value]) => value !== '' && value != null)
);

export const LibraryAPI = {
  /** Soubory odpovídající filtru: { files, count, total }. */
  list: (filters = {}) => AdminAPI.get('/api/admin/library', cleanParams(filters)),

  /** Příponu drží backend podle souboru na disku, zadaný text ji nezmění. */
  rename: (fileId, name) =>
    AdminAPI.put(`/api/admin/library/files/${fileId}`, { name }),

  remove: (fileId, { force = false } = {}) =>
    AdminAPI.delete(`/api/admin/library/files/${fileId}`, {}, { force }),

  /** ZIP vyfiltrovaných souborů. Vrací Blob - stažení řeší volající. */
  exportZip: (filters = {}) => fetchBlob('/api/admin/library/export.zip', {
    params: cleanParams(filters),
    headers: adminAuthHeaders()
  }),

  /** Připne existující soubor k sezóně, čímž se objeví na /dokumenty. */
  publishToSeason: (fileId, seasonYear) =>
    AdminAPI.post('/api/admin/attachments/link', {
      file_id: fileId,
      owner_type: 'season',
      owner_id: seasonYear,
      role: 'document'
    }),

  seasons: () => AdminAPI.get('/api/admin/seasons')
};

export default LibraryAPI;
