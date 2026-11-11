import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { User } from 'firebase/auth';
import CreatorGames from '@/components/creatorGames';
import { UserContext } from '@/lib/context';
import Game from '@/lib/game';

jest.mock('@/lib/firebase/firebase', () => ({ auth: { currentUser: null } }));
jest.mock('@/components/banner', () => () => null);

const publicGame: Game = {
  id: 'public-id',
  username: 'creator',
  slug: 'listed',
  name: 'Listed Game',
  bannerImageUrl: '',
  autoUpdateUrl: '',
  copyright: '',
  uploadedAt: new Date('2026-10-01T00:00:00.000Z'),
  visibility: 'public',
};
// The API serializes dates as ISO strings.
const serialized = (game: Game) => ({ ...game, uploadedAt: game.uploadedAt.toISOString() });
const privateGame: Game = {
  ...publicGame,
  id: 'private-id',
  slug: 'unlisted',
  name: 'Unlisted Game',
  uploadedAt: new Date('2026-10-02T00:00:00.000Z'),
  visibility: 'private',
};
const user = { getIdToken: async () => 'owner-token' } as unknown as User;
const originalFetch = global.fetch;

afterEach(() => {
  jest.restoreAllMocks();
  global.fetch = originalFetch;
});

/** Renders a creator's profile list for the given signed-in username. */
function renderProfile(username: string | null) {
  render(
    <UserContext.Provider value={{ user: username ? user : null, username }}>
      <CreatorGames username="creator" games={[publicGame]} />
    </UserContext.Provider>,
  );
}

describe('creator profile games', () => {
  it.each([null, 'someone-else'])('shows only public games to %s', (username) => {
    global.fetch = jest.fn();
    renderProfile(username);
    expect(screen.getByText('Listed Game')).toBeInTheDocument();
    expect(screen.queryByText('Unlisted Game')).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('adds private games for the signed-in creator', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [serialized(privateGame), serialized(publicGame)],
    });
    renderProfile('creator');
    expect(await screen.findByText('Unlisted Game')).toBeInTheDocument();
    expect(screen.getByText('Listed Game')).toBeInTheDocument();
    expect(screen.getByText('Private')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/games/mine', {
      headers: { Authorization: 'Bearer owner-token' },
    });
  });

  it('keeps the public list and reports when the creator games cannot be loaded', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    renderProfile('creator');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your private games could not be loaded.',
    );
    expect(screen.getByText('Listed Game')).toBeInTheDocument();
    expect(screen.queryByText('Unlisted Game')).not.toBeInTheDocument();
  });

  it('does not claim a creator has no games when loading them failed, and retries', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, json: async () => [serialized(privateGame)] });
    render(
      <UserContext.Provider value={{ user, username: 'creator' }}>
        <CreatorGames username="creator" games={[]} />
      </UserContext.Provider>,
    );
    await screen.findByRole('alert');
    expect(screen.queryByText('No games found.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Unlisted Game')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
