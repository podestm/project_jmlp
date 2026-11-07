import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Paska from './Paska.jsx';

describe('Paska', () => {
  it('je nadpis zadané úrovně', () => {
    render(<Paska as="h3" aside="2 závody">Závody sezóny</Paska>);
    expect(screen.getByRole('heading', { level: 3, name: 'Závody sezóny' })).toBeInTheDocument();
    expect(screen.getByText('2 závody')).toBeInTheDocument();
  });
});
