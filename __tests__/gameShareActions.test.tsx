import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import GameShareActions from '@/components/gameShareActions';
import { UserContext } from '@/lib/context';
import { GameVisibility } from '@/lib/game';

jest.mock('@/lib/firebase/firebase', () => ({ auth: { currentUser: null } }));

const writeText = jest.fn();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  window.history.replaceState(null, '', '/creator/game?ref=chat#top');
});

/** Renders the game page actions for a signed-in username, or a signed-out visitor. */
function renderActions(username: string | null, visibility: GameVisibility = 'public') {
  render(
    <UserContext.Provider value={{ user: null, username }}>
      <GameShareActions gameId="game-id" owner="creator" visibility={visibility} />
    </UserContext.Provider>,
  );
}

describe('game page share actions', () => {
  it.each([null, 'someone-else', 'creator'])(
    'lets every visitor (%s) copy the page link without its query or fragment',
    async (username) => {
      renderActions(username);
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy link' })));
      expect(writeText).toHaveBeenCalledWith(window.location.origin + '/creator/game');
      expect(screen.getByRole('button', { name: 'Link copied!' })).toBeInTheDocument();
    },
  );

  it.each([null, 'someone-else'])('hides the visibility toggle from %s', (username) => {
    renderActions(username, 'private');
    expect(screen.queryByRole('button', { name: /^Make game/ })).not.toBeInTheDocument();
  });

  it.each([
    ['public', 'Make game private'],
    ['private', 'Make game public'],
  ] as const)('offers the owner of a %s game to "%s"', (visibility, label) => {
    renderActions('creator', visibility);
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
  });
});
