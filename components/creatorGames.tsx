'use client';

import { useContext, useEffect, useState } from 'react';
import { UserContext } from '@/lib/context';
import Game from '@/lib/game';
import GamesDeck from '@/components/gamesDeck';

interface CreatorGamesProps {
  username: string;
  /** The creator's public games, as rendered for every visitor. */
  games: Game[];
}

type SerializedGame = Omit<Game, 'uploadedAt'> & { uploadedAt: string };

/** Lists a creator's public games, adding their private games when the creator is signed in. */
export default function CreatorGames({ username, games }: CreatorGamesProps) {
  const { user, username: viewer } = useContext(UserContext);
  const [ownedGames, setOwnedGames] = useState<Game[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const owner = viewer === username ? user : null;

  useEffect(() => {
    if (!owner) return;
    let cancelled = false;
    (async () => {
      try {
        const idToken = await owner.getIdToken();
        const response = await fetch('/api/games/mine', {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!response.ok) throw new Error(`Failed to load your games (${response.status})`);
        const mine: SerializedGame[] = await response.json();
        if (cancelled) return;
        setOwnedGames(mine.map((game) => ({ ...game, uploadedAt: new Date(game.uploadedAt) })));
        setLoadFailed(false);
      } catch (error) {
        console.error('Error loading your games:', error);
        if (!cancelled) setLoadFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [owner, attempt]);

  if (owner && ownedGames) return <GamesDeck games={ownedGames} canManage />;
  if (owner && loadFailed) {
    // The public games are still accurate, but "No games found" would hide the private ones.
    return (
      <>
        <div role="alert" className="mb-4 flex flex-col items-center text-center">
          <p>Your private games could not be loaded.</p>
          <button type="button" onClick={() => setAttempt((count) => count + 1)}>
            Retry
          </button>
        </div>
        {games.length > 0 && <GamesDeck games={games} canManage />}
      </>
    );
  }
  return <GamesDeck games={games} canManage />;
}
