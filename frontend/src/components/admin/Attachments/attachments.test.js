import { describe, expect, it } from 'vitest';
import { acceptText, buildSlots, filterLibrary, slotConfig, slotLabel } from './attachments.js';

describe('správce příloh', () => {
  it('sloty: vylučovací skupina je jeden slot, volná role je seznam', () => {
    const slots = buildSlots('season', [['vysledky', 'prubezne'], 'document']);
    expect(slots).toEqual([
      { key: 'vysledky+prubezne', roles: ['vysledky', 'prubezne'], single: true },
      { key: 'document', roles: ['document'], single: false },
    ]);
    expect(slotLabel(slots[0], 'prubezne')).toBe('Výsledky sezóny');
  });

  it('závod má od každé role jeden soubor', () => {
    expect(buildSlots('race', ['propozice']).at(0).single).toBe(true);
    expect(slotConfig('logo').accept).toBe('.jpg,.jpeg,.png');
    expect(slotConfig('neznama').hint).toBe('');
  });

  it('knihovna se filtruje podle přípony i názvu', () => {
    const files = [{ original_filename: 'propozice.pdf' }, { original_filename: 'foto.jpg' }, { original_filename: 'pokyny.PDF' }];
    expect(filterLibrary(files, '.pdf', '')).toHaveLength(2);
    expect(filterLibrary(files, '.pdf', 'POK')).toEqual([{ original_filename: 'pokyny.PDF' }]);
    expect(filterLibrary(files, undefined, '')).toHaveLength(3);
    expect(acceptText('.jpg,.png')).toBe('Nabízíme jen JPG, PNG.');
  });
});
