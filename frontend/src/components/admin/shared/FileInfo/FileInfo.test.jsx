import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FileInfo from './FileInfo.jsx';

const FILE = { original_filename: 'Pokyny.pdf', file_size: 2048, uploaded_at: '2026-09-16T10:00:00', download_url: '/u/p.pdf' };

describe('FileInfo', () => {
  it('název jako odkaz, velikost a datum nahrání', () => {
    render(<FileInfo file={FILE} link><span>použit 2×</span></FileInfo>);
    expect(screen.getByRole('link', { name: 'Pokyny.pdf' })).toHaveAttribute('href', '/u/p.pdf');
    expect(screen.getByText('2 KB · nahráno 16. 9. 2026')).toBeInTheDocument();
    expect(screen.getByText('použit 2×')).toBeInTheDocument();
  });
});
