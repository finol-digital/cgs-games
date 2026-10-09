import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server.node';
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
  uploadedAt: new Date('2026-10-07T00:30:00.000Z'),
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
  it('hydrates without a mismatch when the browser uses a different locale and time zone', () => {
    const localeDate = jest.spyOn(Date.prototype, 'toLocaleDateString');
    localeDate.mockReturnValue('10/7/2026');
    const card = <GameCard game={game} canDelete={false} />;
    const container = document.createElement('div');
    container.innerHTML = renderToString(card);
    expect(container.querySelector('time')).toHaveTextContent('2026-10-07');
    expect(localeDate).not.toHaveBeenCalled();

    localeDate.mockReturnValue('06/10/2026');
    const onRecoverableError = jest.fn();
    render(card, { container, hydrate: true, onRecoverableError });

    expect(container.querySelector('time')).toHaveTextContent('06/10/2026');
    expect(container.querySelector('time')).toHaveAttribute(
      'datetime',
      game.uploadedAt.toISOString(),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
  });

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
