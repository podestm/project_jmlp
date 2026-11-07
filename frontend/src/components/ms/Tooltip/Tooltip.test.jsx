import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import Button from '../Button/Button.jsx';
import IconButton from '../IconButton/IconButton.jsx';
import Tooltip from './Tooltip.jsx';

describe('Tooltip', () => {
  it('poznámka je popisem tlačítka i když je skrytá', () => {
    render(<Tooltip text="Vyžaduje připojení"><Button>Publikovat</Button></Tooltip>);
    expect(screen.getByRole('button', { name: 'Publikovat' })).toHaveAccessibleDescription('Vyžaduje připojení');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('ukáže se při fokusu a zmizí při Escape a ztrátě fokusu', async () => {
    render(<Tooltip text="Vyžaduje připojení"><Button>Publikovat</Button></Tooltip>);
    await userEvent.tab();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Vyžaduje připojení');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await userEvent.tab();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    await userEvent.tab();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('najetí myší funguje i u zakázaného tlačítka', () => {
    render(<Tooltip text="Vyžaduje připojení"><Button disabled>Publikovat</Button></Tooltip>);
    const trigger = screen.getByRole('button', { name: 'Publikovat' }).parentElement;
    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('zachová vlastní aria-describedby a umí IconButton nahoře', () => {
    render(
      <>
        <span id="jiny">Jiný popis</span>
        <Tooltip text="Smaže i časy" placement="top">
          <IconButton icon="trash" label="Smazat" aria-describedby="jiny" />
        </Tooltip>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Smazat' })).toHaveAccessibleDescription('Jiný popis Smaže i časy');
  });

  it('bez textu vrátí dítě beze změny', () => {
    render(<Tooltip text=""><Button>Tisk</Button></Tooltip>);
    expect(screen.getByRole('button', { name: 'Tisk' }).parentElement.tagName).not.toBe('SPAN');
  });
});
