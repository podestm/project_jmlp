import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import InlineEditRow from './InlineEditRow.jsx';

describe('InlineEditRow', () => {
  it('pole, náhled kategorie a Uložit / Zrušit', async () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(
      <table><tbody>
        <InlineEditRow colSpan={3} columns="1fr" categoryPreview="Předžáci" onSave={onSave} onCancel={onCancel}>
          <input aria-label="Jméno" />
        </InlineEditRow>
      </tbody></table>,
    );
    expect(screen.getByLabelText('Jméno')).toBeInTheDocument();
    expect(screen.getByText('Předžáci')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Uložit' }));
    await userEvent.click(screen.getByRole('button', { name: 'Zrušit' }));
    expect(onSave).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });
});
