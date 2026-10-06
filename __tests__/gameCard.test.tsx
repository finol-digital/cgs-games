import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GameCard from '@/components/gameCard';
import { UserContext } from '@/lib/context';
import Game from '@/lib/game';

jest.mock('@/lib/firebase/firebase', () => ({
  auth: { currentUser: { getIdToken: async () => 'test-token' } },
}));
jest.mock('@/components/banner', () => () => null);

const game: Game = {
  id: 'game-id',
  username: 'creator',
  slug: 'game',
  name: 'Game',
  bannerImageUrl: '',
  autoUpdateUrl: '',
  copyright: '',
  uploadedAt: new Date(),
};
const originalFetch = global.fetch;

afterEach(() => {
  jest.restoreAllMocks();
  global.fetch = originalFetch;
});

describe('game deletion feedback', () => {
  it.each([
    [
      '{"error":"You can only delete your own games","code":"FORBIDDEN","hint":"Sign in as owner"}',
      'You can only delete your own games',
    ],
    ['Legacy server error', 'Legacy server error'],
    ['{"code":"INTERNAL_ERROR"}', 'Failed to delete game'],
    ['', 'Failed to delete game'],
  ])('displays a readable error for %s', async (body, expected) => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const alert = jest.spyOn(window, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn().mockResolvedValue({ ok: false, text: async () => body });
    render(
      <UserContext.Provider value={{ user: null, username: 'creator' }}>
        <GameCard game={game} canDelete />
      </UserContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete game' }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith(expected));
    expect(screen.getByRole('button', { name: 'Delete game' })).toBeEnabled();
  });
});

describe('game upload date', () => {
  it('shows when the game was uploaded', () => {
    render(
      <UserContext.Provider value={{ user: null, username: 'creator' }}>
        <GameCard game={game} canDelete={false} />
      </UserContext.Provider>,
    );

    expect(screen.getByText(game.uploadedAt.toLocaleDateString())).toHaveAttribute(
      'datetime',
      game.uploadedAt.toISOString(),
    );
  });
});
