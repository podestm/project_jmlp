import { describe, expect, it } from 'vitest';
import { fixEncoding, formatText } from './text.js';

/**
 * Vyrobí přesně tu zkomoleninu, která vzniká v databázi: UTF-8 bajty
 * přečtené jako Latin-1. Psát ji do zdrojáku ručně nejde - obsahuje
 * neviditelné řídicí znaky, které se při kopírování ztratí.
 */
const mojibake = (text) =>
  Array.from(new TextEncoder().encode(text), (byte) => String.fromCharCode(byte)).join('');

describe('fixEncoding', () => {
  it('opraví dvojitě zakódovanou češtinu', () => {
    expect(fixEncoding(mojibake('Petrův'))).toBe('Petrův');
    expect(fixEncoding(mojibake('Němčičky'))).toBe('Němčičky');
    expect(fixEncoding(mojibake('Závod v areálu'))).toBe('Závod v areálu');
  });

  it('opraví i písmena, která stará tabulka náhrad ztrácela', () => {
    // 'Ä' byl v mapě třikrát, takže z něj v objektu přežilo jen poslední 'ě'
    // a převod na č, ď, ň i ř se ztratil.
    expect(fixEncoding(mojibake('červený'))).toBe('červený');
    expect(fixEncoding(mojibake('Řehoř'))).toBe('Řehoř');
    expect(fixEncoding(mojibake('Dvořák'))).toBe('Dvořák');
    expect(fixEncoding(mojibake('ďábel'))).toBe('ďábel');
    expect(fixEncoding(mojibake('kůň'))).toBe('kůň');
  });

  it('správný text nechá být', () => {
    expect(fixEncoding('Němčičky')).toBe('Němčičky');
    expect(fixEncoding('Jan Novák')).toBe('Jan Novák');
  });

  it('nezkomolí cizí jméno se samostatným Å nebo Ä', () => {
    // Tohle stará verze rozbíjela: 'Å' -> 'ô', 'Ä' -> 'ě'.
    expect(fixEncoding('Åke Larsson')).toBe('Åke Larsson');
    expect(fixEncoding('Käthe Müller')).toBe('Käthe Müller');
  });

  it('prázdnou hodnotu vrací beze změny', () => {
    expect(fixEncoding('')).toBe('');
    expect(fixEncoding(null)).toBeNull();
    expect(fixEncoding(undefined)).toBeUndefined();
  });
});

describe('formatText', () => {
  it('převede tučně, kurzívu a konce řádků', () => {
    expect(formatText('**tučně**')).toBe('<strong>tučně</strong>');
    expect(formatText('*kurzíva*')).toBe('<em>kurzíva</em>');
    expect(formatText('první\ndruhý')).toBe('první<br>druhý');
  });

  it('escapuje HTML dřív, než přidá vlastní značky', () => {
    // Bez toho by šel do dangerouslySetInnerHTML cizí skript.
    expect(formatText('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(formatText('<img onerror="x">')).not.toContain('<img');
  });

  it('prázdný text dá prázdný řetězec', () => {
    expect(formatText('')).toBe('');
    expect(formatText(null)).toBe('');
  });
});
