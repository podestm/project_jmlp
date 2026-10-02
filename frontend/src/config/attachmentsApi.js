/**
 * Přílohy - jediné místo, kde se v adminu pracuje se soubory připojenými
 * k závodu, příspěvku, sezóně nebo klubu.
 *
 * Dřív měl každý formulář vlastní vyhledávání v knihovně a soubor se musel
 * nahrát předem. Tady se nahrává rovnou k dané věci jedním requestem.
 */
import { AdminAPI } from './api.js';

/** Typy vlastníků - musí odpovídat AttachmentOwner v backend/app/models.py */
export const OWNER = {
  race: 'race',
  post: 'post',
  season: 'season',
  club: 'club',
  library: 'library'
};

/** Role příloh - musí odpovídat AttachmentRole v backend/app/models.py */
export const ROLE = {
  propozice: 'propozice',
  vysledky: 'vysledky',
  prubezne: 'prubezne',
  image: 'image',
  document: 'document',
  logo: 'logo',
  sponzori: 'sponzori',
  other: 'other'
};

/**
 * Role povolené u daného vlastníka - zrcadlí ATTACHMENT_ROLES_BY_OWNER
 * v backend/app/models.py. Backend jiné role odmítne s 400, tohle je jen
 * proto, aby je UI vůbec nenabízelo.
 *
 * Závod má propozice, výsledky a pruh sponzorů, od každého nejvýše jeden soubor.
 */
export const ROLES_BY_OWNER = {
  [OWNER.race]: [ROLE.propozice, ROLE.vysledky, ROLE.sponzori],
  [OWNER.post]: [ROLE.image, ROLE.document],
  [OWNER.season]: [ROLE.vysledky, ROLE.prubezne, ROLE.document],
  [OWNER.club]: [ROLE.logo],
  [OWNER.library]: [ROLE.document, ROLE.image, ROLE.other]
};

/**
 * Skupiny rolí, ze kterých smí mít vlastník dohromady nejvýše jeden dokument -
 * zrcadlí ATTACHMENT_EXCLUSIVE_GROUPS v backend/app/models.py.
 *
 * U sezóny jsou průběžné a celkové výsledky ve stejné skupině: během sezóny
 * platí průběžné pořadí, po jejím konci ho nahradí celkové. Obojí zároveň
 * z podstaty věci neexistuje.
 */
export const EXCLUSIVE_GROUPS = {
  [OWNER.race]: [[ROLE.propozice], [ROLE.vysledky], [ROLE.sponzori]],
  [OWNER.post]: [[ROLE.image], [ROLE.document]],
  [OWNER.season]: [[ROLE.vysledky, ROLE.prubezne]],
  [OWNER.club]: [[ROLE.logo]]
};

export const ROLE_LABELS = {
  [ROLE.propozice]: 'Propozice',
  [ROLE.vysledky]: 'Výsledky',
  [ROLE.prubezne]: 'Průběžné výsledky',
  [ROLE.image]: 'Obrázek',
  [ROLE.document]: 'Dokument',
  [ROLE.logo]: 'Logo',
  [ROLE.sponzori]: 'Sponzoři',
  [ROLE.other]: 'Ostatní'
};

/**
 * Role, které danou roli u tohoto vlastníka vylučují (včetně jí samotné),
 * nebo null, když vlastník smí mít takových dokumentů víc.
 */
export const exclusiveGroup = (ownerType, role) =>
  (EXCLUSIVE_GROUPS[ownerType] || []).find((group) => group.includes(role)) || null;

export const AttachmentsAPI = {
  list: (ownerType, ownerId, role) =>
    AdminAPI.get('/api/admin/attachments', {
      owner_type: ownerType,
      owner_id: ownerId,
      ...(role ? { role } : {})
    }),

  /** Nahraje soubor a rovnou ho připojí - jeden request, bez mezikroku v knihovně. */
  upload: (file, { ownerType, ownerId, role } = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('owner_type', ownerType);
    if (ownerId !== null && ownerId !== undefined) formData.append('owner_id', ownerId);
    formData.append('role', role);
    return AdminAPI.upload('/api/admin/attachments', formData);
  },

  /** Připojí soubor, který už v knihovně je. */
  link: (fileId, { ownerType, ownerId, role } = {}) =>
    AdminAPI.post('/api/admin/attachments/link', {
      file_id: fileId,
      owner_type: ownerType,
      owner_id: ownerId,
      role
    }),

  update: (attachmentId, changes) =>
    AdminAPI.put(`/api/admin/attachments/${attachmentId}`, changes),

  reorder: (attachmentIds) =>
    AdminAPI.post('/api/admin/attachments/reorder', { attachment_ids: attachmentIds }),

  /** Odpojí přílohu. `deleteFile` navíc smaže soubor z knihovny i z disku. */
  remove: (attachmentId, { deleteFile = false } = {}) =>
    AdminAPI.delete(`/api/admin/attachments/${attachmentId}`, {}, { delete_file: deleteFile }),

  /** Knihovna souborů pro výběr už nahraného dokumentu. */
  library: () => AdminAPI.get('/api/admin/files')
};
