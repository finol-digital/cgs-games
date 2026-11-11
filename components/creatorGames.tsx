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
      } catch (error) {
        // The public list is still accurate; only the owner's private games are missing from it.
        console.error('Error loading your games:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [owner]);

  return <GamesDeck games={owner && ownedGames ? ownedGames : games} canManage />;
}
