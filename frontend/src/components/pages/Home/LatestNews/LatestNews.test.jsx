import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import LatestNews from './LatestNews.jsx';

const renderNews = (posts) =>
  render(
    <MemoryRouter>
      <LatestNews posts={posts} />
    </MemoryRouter>,
  );

describe('LatestNews', () => {
  it('aktuality s obrázkem po straně a odkaz na starší', () => {
    renderNews({
      status: 'ready',
      data: [
        {
          id: 5,
          title: 'Sezóna začíná',
          content: 'Text',
          created_at: '2026-09-16T10:00:00',
          image_file_id: 2,
          image_position: 'top',
        },
      ],
      load: vi.fn(),
    });
    expect(
      screen.getByRole('heading', { level: 3, name: 'Sezóna začíná' }).closest('article'),
    ).toHaveAttribute('data-image', 'right');
    expect(screen.getByRole('link', { name: 'Starší zprávy →' })).toHaveAttribute(
      'href',
      '/aktuality',
    );
  });

  it('chyba nabídne nové načtení', async () => {
    const load = vi.fn();
    renderNews({ status: 'error', data: [], load });
    await userEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(load).toHaveBeenCalled();
  });
});
