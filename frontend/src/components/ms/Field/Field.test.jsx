import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Input from '../Input/Input.jsx';
import Select from '../Select/Select.jsx';
import Field from './Field.jsx';

describe('Field', () => {
  it('provází popisek s polem a nápovědou', () => {
    render(
      <Field label="Jméno" hint="Jak je v průkazu" required>
        <Input />
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: /Jméno/ });
    expect(input).toBeRequired();
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).toHaveAccessibleDescription('Jak je v průkazu');
  });

  it('chyba nastaví aria-invalid a popis', () => {
    render(
      <Field label="Příjmení" error="Napište příjmení závodníka.">
        <Input />
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: 'Příjmení' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Napište příjmení závodníka.');
  });

  it('bez chyby se chybový text nevykreslí', () => {
    const { container } = render(
      <Field label="Klub">
        <Input />
      </Field>,
    );
    expect(container.querySelector('[id$="-chyba"]')).toBeNull();
  });

  it('render-prop varianta dostane atributy', () => {
    render(
      <Field label="Sezóna" error="Vyberte sezónu">
        {(props) => (
          <Select {...props}>
            <option>2026/27</option>
          </Select>
        )}
      </Field>,
    );
    expect(screen.getByRole('combobox', { name: 'Sezóna' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });
});
