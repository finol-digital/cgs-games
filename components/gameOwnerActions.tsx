'use client';

import { useContext } from 'react';
import { UserContext } from '@/lib/context';
import { GameVisibility } from '@/lib/game';
import { CardAction } from '@/components/ui/card';
import DeleteGameButton from '@/components/deleteGameButton';
import VisibilityToggle from '@/components/visibilityToggle';

interface GameOwnerActionsProps {
  gameId: string;
  owner: string;
  visibility: GameVisibility;
}

/** Keeps owner-only controls interactive without hydrating the entire game card. */
export default function GameOwnerActions({ gameId, owner, visibility }: GameOwnerActionsProps) {
  const { username } = useContext(UserContext);
  if (username !== owner) return null;
  return (
    <CardAction className="flex shrink-0 items-center gap-1">
      <VisibilityToggle gameId={gameId} visibility={visibility} />
      <DeleteGameButton gameId={gameId} />
    </CardAction>
  );
}
