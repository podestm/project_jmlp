import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { timekeeperDb } from '../../../offline/db.js';
import { resetTimekeeperDb } from '../../../test/helpers.js';
import SyncCenter from './SyncCenter.jsx';

const now = new Date().toISOString();

beforeEach(async () => {
  await resetTimekeeperDb();
  await timekeeperDb.syncQueue.bulkAdd([
    { op_id: 'a', method: 'PUT', endpoint: '/api/timekeeper/start-list/7/time', payload: { time1: '34.07' }, status: 'dead', retry_count: 8, created_at: now, last_error: 'Server neodpovídá' },
    { op_id: 'b', method: 'PUT', endpoint: '/api/timekeeper/start-list/8/time', payload: { dnf: true }, status: 'pending', retry_count: 0, created_at: now },
  ]);
  await timekeeperDb.conflicts.add({
    queue_item_id: 99, op_id: 'c', endpoint: '/api/timekeeper/start-list/9/time', method: 'PUT',
    payload: { time1: '35.90' }, status_code: 409, error_message: 'Záznam se mezitím změnil',
    conflict_detail: { code: 'stale_revision', entry_id: 9 }, created_at: now, resolved: 0,
  });
});

const renderScreen = () => render(<MemoryRouter><SyncCenter /></MemoryRouter>);

describe('Synchronizace', () => {
  it('fronta říká stav slovy a neodeslaný zápis jde poslat znovu', async () => {
    renderScreen();
    const table = await screen.findByRole('table');
    expect(await within(table).findByText('Záznam #7: kolo 1 34.07')).toBeInTheDocument();
    expect(within(table).getByText('Neodesláno')).toBeInTheDocument();
    expect(within(table).getByText('Ve frontě')).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: 'Zkusit znovu' })).toBeInTheDocument();
  });

  it('Přepsat server se ještě zeptá a Enter nic nepřepíše', async () => {
    renderScreen();
    await userEvent.click(await screen.findByRole('button', { name: 'Přepsat server' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Zrušit' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect((await timekeeperDb.conflicts.toArray())[0].resolved).toBe(0);
  });
});
