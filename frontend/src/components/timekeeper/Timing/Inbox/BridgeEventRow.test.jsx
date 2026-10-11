import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BridgeEventRow from './BridgeEventRow.jsx';

/**
 * Řádek inboxu je poslední místo, kde obsluha vidí, KOMU se čas zapíše.
 * Proto tam patří všechno, podle čeho se to dá zkontrolovat - jméno,
 * kategorie i startovní číslo - bez ohledu na to, kolik závodníků má
 * shodou okolností stejný dres.
 */

const entry = (overrides = {}) => ({
  id: 1,
  racer_name: 'Anna',
  racer_surname: 'Holčičková',
  category_name: 'Předžačky',
  start_number: 7,
  race_number_actual: 23,
  set_color: 'rose',
  ...overrides
});

const event = (overrides = {}) => ({
  id: 'ev-1',
  ts: Date.parse('2026-03-01T10:00:00Z'),
  bib: 23,
  time: '01:02.34',
  status: 'pending',
  reason: 'ready',
  targetRound: '1',
  raw: 'TIME;23;01:02.34',
  ...overrides
});

const renderRow = (props = {}) => render(
  <BridgeEventRow
    event={event()}
    resolvedEntry={entry()}
    candidateCount={1}
    candidateIndex={0}
    fallbackTargetRound="1"
    onCycle={vi.fn()}
    onConfirm={vi.fn()}
    onReject={vi.fn()}
    {...props}
  />
);

describe('BridgeEventRow', () => {
  it('ukazuje kategorii i startovní číslo, i když dres nikdo nesdílí', () => {
    renderRow();

    expect(screen.getByText(/Holčičková Anna/)).toBeInTheDocument();
    expect(screen.getByText(/Předžačky/)).toBeInTheDocument();
    expect(screen.getByText(/st\. č\. 7/)).toBeInTheDocument();
  });

  it('při více kandidátech přibude jen počítadlo, popis zůstává stejný', () => {
    renderRow({ candidateCount: 2, candidateIndex: 0 });

    expect(screen.getByText(/1\/2/)).toBeInTheDocument();
    expect(screen.getByText(/Předžačky/)).toBeInTheDocument();
  });

  it('závodník bez kategorie nebo startovního čísla nic nerozbije', () => {
    renderRow({ resolvedEntry: entry({ category_name: null, start_number: null }) });

    expect(screen.getByText(/Holčičková Anna/)).toBeInTheDocument();
    expect(screen.queryByText(/st\. č\./)).not.toBeInTheDocument();
  });

  it.each(['DNF', 'DNS', 'DSQ'])('%s z časomíry ukáže stav, ne "bez času"', (type) => {
    renderRow({ event: event({ type, time: null, raw: `18 23 ${type}` }) });

    expect(screen.getByText(type)).toBeInTheDocument();
    expect(screen.queryByText(/bez času/)).not.toBeInTheDocument();
  });

  it('čas bez hodnoty dál hlásí "bez času"', () => {
    renderRow({ event: event({ type: 'TIME', time: null }) });

    expect(screen.getByText(/bez času/)).toBeInTheDocument();
  });

  it('nerozpoznaný řádek ukazuje syrový text a nemá koho přiřadit', () => {
    renderRow({
      event: event({ reason: 'unparsed', raw: 'ABC;;;' }),
      resolvedEntry: null,
      candidateCount: 0,
      candidateIndex: -1
    });

    expect(screen.getByText('ABC;;;')).toBeInTheDocument();
    expect(screen.queryByText(/Předžačky/)).not.toBeInTheDocument();
  });

  it('dres vyřazeného ze startky to řekne místo obecného "není ve startovní listině"', () => {
    renderRow({
      event: event({ status: 'warning', reason: 'bib_not_found' }),
      resolvedEntry: null,
      candidateCount: 0,
      candidateIndex: -1,
      excludedMatch: true
    });

    expect(screen.getByText(/vyřazený ze startky – vraťte ho v Listině/)).toBeInTheDocument();
    expect(screen.queryByText(/není ve startovní listině/)).not.toBeInTheDocument();
    // Komu by se čas zapsal, není - potvrdit nejde.
    expect(screen.getByTitle('Přiřadit a uložit')).toBeDisabled();
  });

  it('bez vyřazení zůstává obecné hlášení', () => {
    renderRow({
      event: event({ status: 'warning', reason: 'bib_not_found' }),
      resolvedEntry: null,
      candidateCount: 0,
      candidateIndex: -1
    });

    expect(screen.getByText(/Číslo dresu není ve startovní listině/)).toBeInTheDocument();
  });
});
