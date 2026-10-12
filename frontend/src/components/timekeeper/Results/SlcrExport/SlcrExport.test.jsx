import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SlcrExport from './SlcrExport.jsx';
import { slcrFileName } from '../useSlcrExport.js';

describe('SlcrExport', () => {
  it('nabídne disciplíny a export spustí tlačítkem', async () => {
    const onExport = vi.fn();
    const onDisciplineChange = vi.fn();
    render(<SlcrExport discipline="" onDisciplineChange={onDisciplineChange} exporting={false} onExport={onExport} isOnline />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Disciplína pro SLČR' }), 'GS');
    expect(onDisciplineChange).toHaveBeenCalledWith('GS');
    await userEvent.click(screen.getByRole('button', { name: /XML pro SLČR/ }));
    expect(onExport).toHaveBeenCalled();
  });

  it('offline je export vypnutý', () => {
    render(<SlcrExport discipline="" onDisciplineChange={() => {}} exporting={false} onExport={() => {}} isOnline={false} />);
    expect(screen.getByRole('button', { name: /XML pro SLČR/ })).toBeDisabled();
  });

  it('název souboru z data a čísla závodu', () => {
    expect(slcrFileName({ datum: '2026-10-18', race_nr: 'JMLP2026-03' }, 5)).toBe('2026-10-18_JMLP2026-03_vysledky-slcr.xml');
    expect(slcrFileName(null, 5)).toBe('zavod-5_vysledky-slcr.xml');
  });
});
