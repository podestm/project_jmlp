import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Screen from './Screen.jsx';

describe('Screen', () => {
  it('obalí obsah a přidá vlastní třídu', () => {
    const { container } = render(
      <Screen className="navic">
        <p>obsah</p>
      </Screen>,
    );
    expect(screen.getByText('obsah')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('navic');
  });
});
