import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import Button from '../Button/Button.jsx';
import Modal from './Modal.jsx';

const dialogOf = () => document.querySelector('dialog');

/** Řízený dialog jako ho použije useConfirm: otevře tlačítko, onClose ho zavře. */
function Harness({ onClose = () => {}, dismissible, footer, initiallyOpen = false }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Otevřít</button>
      <Modal
        open={open}
        dismissible={dismissible}
        eyebrow="Nebezpečná akce"
        title="Odebrat Kučeru Štěpána ze startovní listiny?"
        onClose={(reason) => { onClose(reason); setOpen(false); }}
        footer={footer ?? (
          <>
            <Button data-cancel onClick={() => setOpen(false)}>Zrušit</Button>
            <Button variant="danger">Odebrat Kučeru Štěpána</Button>
          </>
        )}
      >
        <p>Zmizí řádek i příznak DNS.</p>
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('otevře se přes showModal a je pojmenovaný nadpisem', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Otevřít' }));
    const dialog = dialogOf();
    expect(dialog).toHaveAttribute('open');
    expect(screen.getByRole('dialog', { name: 'Odebrat Kučeru Štěpána ze startovní listiny?' })).toBe(dialog);
  });

  it('fokus jde na Zrušit, ne na nebezpečnou volbu', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Otevřít' }));
    expect(screen.getByRole('button', { name: 'Zrušit' })).toHaveFocus();
  });

  it('volba označená data-autofocus dostane fokus přednostně', async () => {
    render(
      <Harness footer={(
        <>
          <Button variant="danger">Přepsat na 35,90</Button>
          <Button data-cancel>Zrušit</Button>
          <Button variant="primary" data-autofocus>Ponechat 35,87</Button>
        </>
      )} />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Otevřít' }));
    expect(screen.getByRole('button', { name: 'Ponechat 35,87' })).toHaveFocus();
  });

  it('Escape (cancel) zavře s důvodem escape a fokus se vrátí', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const opener = screen.getByRole('button', { name: 'Otevřít' });
    await userEvent.click(opener);
    const cancel = new Event('cancel', { cancelable: true });
    fireEvent(dialogOf(), cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledWith('escape');
    expect(dialogOf()).not.toHaveAttribute('open');
    expect(opener).toHaveFocus();
  });

  it('zavření prohlížečem (close bez cancel) se ohlásí jako onClose', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Otevřít' }));
    dialogOf().close();
    expect(onClose).toHaveBeenCalledWith('close');
  });

  it('křížek a klik do překryvu zavírají', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Otevřít' }));
    await userEvent.click(screen.getByRole('button', { name: 'Zavřít dialog' }));
    await userEvent.click(screen.getByRole('button', { name: 'Otevřít' }));
    await userEvent.click(dialogOf());
    expect(onClose.mock.calls).toEqual([['button'], ['backdrop']]);
  });

  it('klik do obsahu dialog nezavře', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Otevřít' }));
    await userEvent.click(screen.getByText('Zmizí řádek i příznak DNS.'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('dismissible={false}: bez křížku, Escape nezavře, po zavření prohlížečem se otevře znovu', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} dismissible={false} initiallyOpen />);
    expect(screen.queryByRole('button', { name: 'Zavřít dialog' })).toBeNull();
    fireEvent(dialogOf(), new Event('cancel', { cancelable: true }));
    dialogOf().close();
    expect(onClose).not.toHaveBeenCalled();
    expect(dialogOf()).toHaveAttribute('open');
  });

  it('zavřený dialog nevykresluje obsah', () => {
    render(<Harness />);
    expect(screen.queryByText('Zmizí řádek i příznak DNS.')).toBeNull();
  });
});
