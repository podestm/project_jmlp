import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Field from '../Field/Field.jsx';
import Textarea from './Textarea.jsx';

describe('Textarea', () => {
  it('ve Field dostane jméno i chybu', () => {
    render(
      <Field label="Text příspěvku" error="Text chybí">
        <Textarea />
      </Field>,
    );
    const textarea = screen.getByRole('textbox', { name: 'Text příspěvku' });
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(textarea).toHaveAttribute('rows', '4');
  });
});
