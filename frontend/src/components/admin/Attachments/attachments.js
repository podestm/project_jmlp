// Konfigurace a čisté funkce správce příloh (AdminPrilohy) – bez Reactu, s testem.
import { exclusiveGroup, ROLE, ROLE_LABELS } from '../../../config/attachmentsApi.js';
import { getExtension } from '../../../utils/files.js';

export const DOCUMENT_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.txt';
export const IMAGE_ACCEPT = '.jpg,.jpeg,.png';

/** Popisek slotu, který pokrývá víc vzájemně se vylučujících rolí. */
const GROUP_LABELS = {
  [`${ROLE.vysledky}+${ROLE.prubezne}`]: 'Výsledky sezóny',
};

/** Popisky a nápovědy jednotlivých rolí - jedno místo pro celou administraci. */
const SLOT_CONFIG = {
  [ROLE.propozice]: { accept: DOCUMENT_ACCEPT, hint: 'Zveřejní se u závodu jako propozice' },
  [ROLE.vysledky]: { accept: DOCUMENT_ACCEPT, hint: 'Zveřejní se u závodu jako výsledková listina' },
  [ROLE.prubezne]: { accept: DOCUMENT_ACCEPT, hint: 'Průběžné pořadí sezóny' },
  [ROLE.document]: {
    accept: DOCUMENT_ACCEPT,
    hint: 'Zveřejní se na /dokumenty, název souboru je zároveň popiskem odkazu',
  },
  [ROLE.image]: { accept: IMAGE_ACCEPT, hint: 'Obrázek zobrazený u příspěvku' },
  [ROLE.logo]: { accept: IMAGE_ACCEPT, hint: 'Logo klubu, použije se v hlavičce výsledkové listiny' },
  [ROLE.sponzori]: {
    accept: IMAGE_ACCEPT,
    hint: 'Pruh s logy sponzorů - tiskne se pod výsledkovou listinou závodu (široký obrázek, cca 7 : 1)',
  },
};

/** Přípona a nápověda role (neznámá role = dokument bez nápovědy). */
export const slotConfig = (role) => SLOT_CONFIG[role] || { accept: DOCUMENT_ACCEPT, hint: '' };

/**
 * Sloty správce podle `roles`. Prvek je role, nebo pole vzájemně se
 * vylučujících rolí. Role mimo jakoukoli vylučovací skupinu smí mít víc
 * dokumentů -> seznam (single: false).
 */
export const buildSlots = (ownerType, roles) => roles.map((entry) => {
  const groupRoles = Array.isArray(entry) ? entry : [entry];
  const single = groupRoles.length > 1 || Boolean(exclusiveGroup(ownerType, groupRoles[0]));
  return { key: groupRoles.join('+'), roles: groupRoles, single };
});

/** Popisek slotu: skupina má vlastní název, jinak název role. */
export const slotLabel = (slot, activeRole) => (
  slot.roles.length > 1 ? GROUP_LABELS[slot.key] || ROLE_LABELS[activeRole] : ROLE_LABELS[activeRole]
);

/** `accept` jako u <input accept> (".pdf,.doc") -> množina přípon, nebo null. */
export const acceptedExtensions = (accept) => {
  if (!accept) return null;
  return new Set(accept.split(',').map((ext) => ext.trim().replace(/^\./, '').toLowerCase()));
};

/** Soubory knihovny podle povolených přípon a hledaného textu v názvu. */
export const filterLibrary = (files, accept, query) => {
  const allowed = acceptedExtensions(accept);
  const needle = query.trim().toLowerCase();
  return files.filter((file) => {
    if (allowed && !allowed.has(getExtension(file.original_filename))) return false;
    if (!needle) return true;
    return (file.original_filename || '').toLowerCase().includes(needle);
  });
};

/** „Nabízíme jen: PDF, DOC, DOCX…“ – co role bere, slovy. */
export const acceptText = (accept) => {
  const allowed = acceptedExtensions(accept);
  return allowed ? `Nabízíme jen ${[...allowed].map((ext) => ext.toUpperCase()).join(', ')}.` : null;
};
