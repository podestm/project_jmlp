import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
vi.mock('../config/api.js', () => ({ API: { get: (...a) => mockGet(...a) } }));

const { loadCurrentSeason, resetCurrentSeason, useCurrentSeason } = await import(
  './useCurrentSeason.js'
);

function Probe() {
  const { seasonId, edition } = useCurrentSeason();
  return (
    <p>
      {seasonId} · {edition}
    </p>
  );
}

const Other = () => <span data-testid="druhy">{useCurrentSeason().seasonId}</span>;

describe('useCurrentSeason', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-11T12:00:00'));
    resetCurrentSeason();
    mockGet.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('do odpovědi platí sezóna podle data, pak ta ze serveru', async () => {
    let answer;
    mockGet.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    render(<Probe />);
    expect(screen.getByText('2026 · 20')).toBeInTheDocument();

    await act(async () => answer({ current_season_id: 2025, edition: 19 }));
    expect(screen.getByText('2025 · 19')).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith('/races/season/current');
  });

  it('server se ptá jen jednou pro všechny komponenty', async () => {
    mockGet.mockResolvedValue({ current_season_id: 2025, edition: 19 });
    render(
      <>
        <Probe />
        <Other />
      </>,
    );
    expect(await screen.findByText('2025 · 19')).toBeInTheDocument();
    expect(screen.getByTestId('druhy')).toHaveTextContent('2025');
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('bez sítě vezme poslední známou sezónu', async () => {
    mockGet.mockResolvedValue({ current_season_id: 2024, edition: 18 });
    await loadCurrentSeason();

    resetCurrentSeason();
    mockGet.mockRejectedValue(new Error('offline'));
    render(<Probe />);
    expect(screen.getByText('2024 · 18')).toBeInTheDocument();
  });

  it('nesmyslná odpověď nic nezmění, force načte znovu', async () => {
    mockGet.mockResolvedValue([]);
    render(<Probe />);
    await act(async () => loadCurrentSeason());
    expect(screen.getByText('2026 · 20')).toBeInTheDocument();

    mockGet.mockResolvedValue({ current_season_id: 2027, edition: 21 });
    await act(async () => loadCurrentSeason({ force: true }));
    expect(screen.getByText('2027 · 21')).toBeInTheDocument();
  });
});
