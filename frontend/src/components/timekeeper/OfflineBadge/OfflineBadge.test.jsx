import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import OfflineBadge from './OfflineBadge.jsx';

describe('OfflineBadge', () => {
  it('jen u závodníka s dočasným (záporným) id', () => {
    const { rerender } = render(<OfflineBadge entry={{ id: -1728000000000123 }} />);
    expect(screen.getByText('offline')).toBeInTheDocument();
    rerender(<OfflineBadge entry={{ id: 42 }} />);
    expect(screen.queryByText('offline')).not.toBeInTheDocument();
  });
});
