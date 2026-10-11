import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import GamesDeck from '@/components/gamesDeck';
import Game from '@/lib/game';

jest.mock('@/lib/firebase/firebase', () => ({ auth: { currentUser: null } }));

const games: Game[] = ['First', 'Second', 'Third'].map((name) => ({
  id: name,
  name,
  slug: name.toLowerCase(),
  username: 'creator',
  bannerImageUrl: '/CardBack.png',
  autoUpdateUrl: '',
  copyright: '',
  uploadedAt: new Date('2026-10-07T00:30:00.000Z'),
}));

describe('game banner loading', () => {
  it('makes both homepage LCP candidates eager while keeping later images lazy', () => {
    render(<GamesDeck games={games} priorityCount={2} />);
    for (const name of ['First', 'Second']) {
      const image = screen.getByRole('img', { name });
      expect(image).toHaveAttribute('loading', 'eager');
      expect(image).toHaveAttribute('fetchpriority', 'high');
      expect(image.getAttribute('src')).toContain('/_next/image?');
      expect(image).toHaveAttribute('srcset');
    }
    expect(screen.getByRole('img', { name: 'Third' })).toHaveAttribute('loading', 'lazy');
  });

  it('keeps longer catalog pages lazy after the first banner', () => {
    render(<GamesDeck games={games} />);
    expect(screen.getByRole('img', { name: 'First' })).toHaveAttribute('loading', 'eager');
    for (const name of ['Second', 'Third']) {
      expect(screen.getByRole('img', { name })).toHaveAttribute('loading', 'lazy');
    }
  });
});
