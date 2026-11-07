import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PostCard from './PostCard.jsx';

const POST = {
  id: 3,
  title: 'Závod na Fajťáku',
  content: '**Registrace** <b>otevřena</b>',
  created_at: '2026-02-20T10:00:00',
  image_file_id: 4,
  image_position: 'left',
  document_file_id: 9,
};

describe('PostCard', () => {
  it('nadpis, datum, escapovaný text a příloha', () => {
    const { container } = render(<PostCard post={POST} />);
    expect(screen.getByRole('heading', { name: 'Závod na Fajťáku' })).toBeInTheDocument();
    expect(screen.getByText('S přílohou')).toBeInTheDocument();
    expect(container.querySelector('strong')).toHaveTextContent('Registrace');
    expect(container.querySelector('b')).toBeNull();
    expect(screen.getByRole('link', { name: 'Stáhnout přílohu' })).toHaveAttribute(
      'href',
      '/posts/3/document/download',
    );
    expect(container.querySelector('article')).toHaveAttribute('data-image', 'left');
  });

  it('bez data pomlčka, na úvodu je obrázek vždy po straně', () => {
    const { container } = render(
      <PostCard post={{ ...POST, created_at: null, image_position: 'top' }} variant="side" />,
    );
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(container.querySelector('article')).toHaveAttribute('data-image', 'right');
  });
});
