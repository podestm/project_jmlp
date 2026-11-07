import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Stack from './Stack.jsx';

describe('Stack', () => {
  it('mezeru předá jen jako custom property', () => {
    const { container } = render(
      <Stack gap={6}>
        <span>a</span>
      </Stack>,
    );
    expect(container.firstChild.getAttribute('style')).toBe('--gap: var(--ms-space-6);');
  });

  it('neznámý krok mezery v dev vyhodí výjimku', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Stack gap={9} />)).toThrow(/Neznámý krok mezery/);
  });
});
