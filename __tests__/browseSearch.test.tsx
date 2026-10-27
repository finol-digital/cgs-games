import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import BrowsePage from '@/app/browse/page';
import { adminGetAllGames } from '@/lib/firebase/admin';
import Game from '@/lib/game';

jest.mock('@/lib/firebase/admin', () => ({ adminGetAllGames: jest.fn() }));
jest.mock(
  '@/components/gamesDeck',
  () =>
    function MockDeck({ games }: { games: Game[] }) {
      return <div data-testid="games">{games.map((game) => game.name).join(', ')}</div>;
    },
);
jest.mock('@/components/footer', () => () => null);

const games = ['Grand Archive', 'Chess'].map((name) => ({
  name,
  username: 'creator',
  slug: name.toLowerCase(),
  copyright: '',
})) as Game[];

describe('Browse search URLs', () => {
  beforeEach(() => {
    jest.mocked(adminGetAllGames).mockResolvedValue(games);
  });

  it('filters a query from the header and resets when another search navigates to Browse', async () => {
    const { rerender } = render(
      await BrowsePage({ searchParams: Promise.resolve({ q: 'Grand' }) }),
    );
    expect(screen.getByRole('textbox', { name: 'Search games' })).toHaveValue('Grand');
    expect(screen.getByTestId('games')).toHaveTextContent(/^Grand Archive$/);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'no match' } });
    expect(screen.getByTestId('games')).toBeEmptyDOMElement();
    rerender(await BrowsePage({ searchParams: Promise.resolve({ q: 'Chess' }) }));
    expect(screen.getByRole('textbox')).toHaveValue('Chess');
    expect(screen.getByTestId('games')).toHaveTextContent(/^Chess$/);
  });

  it.each([{}, { q: ['Chess', 'Grand'] }])(
    'handles missing and repeated q parameters (%j)',
    async (params) => {
      render(await BrowsePage({ searchParams: Promise.resolve(params) }));
      expect(screen.getByRole('textbox')).toHaveValue('q' in params ? 'Chess' : '');
      expect(screen.getByTestId('games')).toHaveTextContent('Chess');
    },
  );
});
