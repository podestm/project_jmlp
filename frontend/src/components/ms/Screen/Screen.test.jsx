import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Screen from './Screen.jsx';

describe('Screen', () => {
  it('kořen má .ms-scope a body světlé pozadí jen dokud je obrazovka připojená', () => {
    const { container, unmount } = render(<Screen><p>obsah</p></Screen>);
    expect(container.firstChild).toHaveClass('ms-scope');
    expect(document.body).toHaveClass('ms-page');
    unmount();
    expect(document.body).not.toHaveClass('ms-page');
  });
});
