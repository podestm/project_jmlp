// File helpers - one authoritative definition of "what kind of file is this".

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']);

// Tón štítku přípony – vzhled k němu dodá FileBadge (admin/shared).
const EXTENSION_TONES = {
  xlsx: 'sheet', xls: 'sheet', xlsm: 'sheet', csv: 'sheet',
  pdf: 'pdf',
  doc: 'doc', docx: 'doc', docm: 'doc',
  zip: 'archive', rar: 'archive', '7z': 'archive'
};

/** Lowercase extension without the dot, '' when there is none. */
export const getExtension = (filename) => {
  if (!filename || !filename.includes('.')) return '';
  return filename.split('.').pop().toLowerCase();
};

/** Uppercase extension for badges, '?' when unknown. */
export const getExtensionLabel = (filename) => getExtension(filename).toUpperCase() || '?';

/** Tón štítku přípony: pdf | sheet | doc | archive | image | neutral. */
export const getExtensionTone = (filename) => {
  const ext = getExtension(filename);
  if (EXTENSION_TONES[ext]) return EXTENSION_TONES[ext];
  return IMAGE_EXTENSIONS.has(ext) ? 'image' : 'neutral';
};

/** Human file size - "1.4 MB". */
export const formatFileSize = (bytes) => {
  if (bytes == null) return '?';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${parseFloat((bytes / 1024 ** i).toFixed(1))} ${units[i]}`;
};

/**
 * Image detection, in order of trust: the backend's file_type enum, the MIME
 * type, then the filename extension.
 */
export const isImageFile = (file) => {
  if (!file) return false;
  if (file.file_type === 'image') return true;
  if (file.mime_type?.startsWith('image/')) return true;
  return IMAGE_EXTENSIONS.has(getExtension(file.original_filename));
};

export const isDocumentFile = (file) => Boolean(file) && !isImageFile(file);

export { IMAGE_EXTENSIONS };
