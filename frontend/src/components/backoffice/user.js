/** Iniciály do odznaku uživatele: „Petr Novotný“ → „PN“, e-mail → první písmeno. */
export const initialsOf = (name = '') => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1 || name.includes('@')) return words[0][0].toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
};

/** Role z účtu slovy (fuj_jmlp_admin.role). */
export const roleLabel = (role) => (role === 'admin' ? 'Admin' : 'Časoměřič');
