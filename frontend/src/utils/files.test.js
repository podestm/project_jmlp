import { describe, expect, it } from 'vitest';
import {
  formatFileSize,
  getExtension,
  getExtensionTone,
  getExtensionLabel,
  isDocumentFile,
  isImageFile
} from './files.js';

describe('getExtension', () => {
  it('vrátí příponu malými písmeny', () => {
    expect(getExtension('Soutěžní řád 2025-2026.PDF')).toBe('pdf');
  });

  it('u názvu bez tečky vrací prázdno', () => {
    expect(getExtension('README')).toBe('');
    expect(getExtension('')).toBe('');
    expect(getExtension(null)).toBe('');
  });

  it('bere poslední příponu', () => {
    expect(getExtension('vysledky.tar.gz')).toBe('gz');
  });
});

describe('getExtensionLabel', () => {
  it('neznámou příponu označí otazníkem', () => {
    expect(getExtensionLabel('soubor')).toBe('?');
    expect(getExtensionLabel('propozice.pdf')).toBe('PDF');
  });
});

describe('getExtensionTone', () => {
  it('rozliší dokumenty, tabulky, archivy a obrázky', () => {
    expect(getExtensionTone('a.pdf')).toBe('pdf');
    expect(getExtensionTone('a.xlsx')).toBe('sheet');
    expect(getExtensionTone('a.docx')).toBe('doc');
    expect(getExtensionTone('a.zip')).toBe('archive');
    expect(getExtensionTone('a.jpg')).toBe('image');
    expect(getExtensionTone('a.xyz')).toBe('neutral');
  });
});

describe('formatFileSize', () => {
  it('volí jednotku podle velikosti', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(1024 * 1024)).toBe('1 MB');
  });

  it('neznámou velikost označí otazníkem', () => {
    expect(formatFileSize(null)).toBe('?');
    expect(formatFileSize(undefined)).toBe('?');
  });

  it('nepřeteče přes gigabajty', () => {
    expect(formatFileSize(5 * 1024 ** 4)).toContain('GB');
  });
});

describe('isImageFile / isDocumentFile', () => {
  it('pozná obrázek podle přípony názvu', () => {
    expect(isImageFile({ original_filename: 'logo.png' })).toBe(true);
    expect(isImageFile({ original_filename: 'propozice.pdf' })).toBe(false);
  });

  it('co není obrázek, je dokument', () => {
    expect(isDocumentFile({ original_filename: 'propozice.pdf' })).toBe(true);
    expect(isDocumentFile({ original_filename: 'logo.png' })).toBe(false);
  });

  it('prázdný soubor není dokument', () => {
    expect(isDocumentFile(null)).toBe(false);
  });
});
