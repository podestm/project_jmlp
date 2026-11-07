import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import SlcrStep from './SlcrStep.jsx';

describe('SlcrStep', () => {
  it('pojmenuje sekci číslem a nadpisem a stav řekne slovem', () => {
    render(
      <SlcrStep number={2} title="Závody v akci" state="current">
        <p>obsah</p>
      </SlcrStep>,
    );
    expect(screen.getByRole('region', { name: 'Krok 2: Závody v akci' })).toBeInTheDocument();
    expect(screen.getByText('Teď')).toBeInTheDocument();
  });

  it('hotový krok má text Hotovo', () => {
    render(
      <SlcrStep number={1} title="Akce" state="done">
        x
      </SlcrStep>,
    );
    expect(screen.getByText('Hotovo')).toBeInTheDocument();
  });
});
