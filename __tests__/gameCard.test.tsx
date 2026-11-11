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
  visibility: 'public',
};
const originalFetch = global.fetch;

afterEach(() => {
  jest.restoreAllMocks();
  global.fetch = originalFetch;
});

describe('game deletion feedback', () => {
  it.each([
    [false, 'creator'],
    [true, 'someone-else'],
    [true, null],
  ])('hides deletion when canManage=%s and username=%s', (canManage, username) => {
    render(
      <UserContext.Provider value={{ user: null, username }}>
        <GameCard game={game} canManage={canManage} />
      </UserContext.Provider>,
    );
    expect(screen.queryByRole('button', { name: 'Delete game' })).not.toBeInTheDocument();
  });

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
        <GameCard game={game} canManage />
      </UserContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete game' }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith(expected));
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/games/game-id',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
    expect(screen.getByRole('button', { name: 'Delete game' })).toBeEnabled();
  });
});

describe('game upload date', () => {
  it('hydrates without a mismatch when the browser uses a different locale and time zone', () => {
    const localeDate = jest.spyOn(Date.prototype, 'toLocaleDateString');
    localeDate.mockReturnValue('10/7/2026');
    const card = <GameCard game={game} canManage={false} />;
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
        <GameCard game={game} canManage={false} />
      </UserContext.Provider>,
    );

    expect(screen.getByText(game.uploadedAt.toLocaleDateString())).toHaveAttribute(
      'datetime',
      game.uploadedAt.toISOString(),
    );
  });
});

describe('game visibility controls', () => {
  it.each([
    [false, 'creator'],
    [true, 'someone-else'],
    [true, null],
  ])('hides visibility controls when canManage=%s and username=%s', (canManage, username) => {
    render(
      <UserContext.Provider value={{ user: null, username }}>
        <GameCard game={game} canManage={canManage} />
      </UserContext.Provider>,
    );
    expect(screen.queryByRole('button', { name: /^Make game/ })).not.toBeInTheDocument();
  });

  it('labels a private game and offers to make it public', () => {
    render(
      <UserContext.Provider value={{ user: null, username: 'creator' }}>
        <GameCard game={{ ...game, visibility: 'private' }} canManage />
      </UserContext.Provider>,
    );
    expect(screen.getByText('Private')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Make game public' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete game' })).toBeInTheDocument();
  });

  it('does not label public games as private', () => {
    render(<GameCard game={game} canManage={false} />);
    expect(screen.queryByText('Private')).not.toBeInTheDocument();
  });

  it('requests the private visibility for its owner and reports a failure', async () => {
    const alert = jest.spyOn(window, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'You can only update your own games' }),
    });
    render(
      <UserContext.Provider value={{ user: null, username: 'creator' }}>
        <GameCard game={game} canManage />
      </UserContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Make game private' }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('You can only update your own games'));
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/games/game-id',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        body: JSON.stringify({ visibility: 'private' }),
      }),
    );
    expect(screen.getByRole('button', { name: 'Make game private' })).toBeEnabled();
  });

  it('asks for confirmation before listing a private game publicly', () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    global.fetch = jest.fn();
    render(
      <UserContext.Provider value={{ user: null, username: 'creator' }}>
        <GameCard game={{ ...game, visibility: 'private' }} canManage />
      </UserContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Make game public' }));
    expect(confirm).toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
