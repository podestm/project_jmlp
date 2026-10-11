import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Container from './Container.jsx';

describe('Container', () => {
  it('vykreslí zadaný element s obsahem', () => {
    render(<Container as="main">obsah</Container>);
    expect(screen.getByRole('main')).toHaveTextContent('obsah');
  });
});
