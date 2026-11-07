import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Cluster from './Cluster.jsx';

describe('Cluster', () => {
  it('vykreslí potomky v zadaném elementu', () => {
    render(
      <Cluster as="ul" gap={2}>
        <li>DNF</li>
        <li>DNS</li>
      </Cluster>,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});
