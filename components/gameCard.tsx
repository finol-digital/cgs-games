'use client';

import React from 'react';

import { auth } from '@/lib/firebase/firebase';
import Game from '@/lib/game';
import Link from 'next/link';
import { useContext, useState, useSyncExternalStore } from 'react';
import { CalendarDays } from 'lucide-react';
import Banner from './banner';

import { UserContext } from '@/lib/context';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './ui/card';

interface GameCardProps {
  game: Game;
  canDelete: boolean;
  priority?: boolean;
}

// Locale formatting has no subscription; React switches snapshots after hydration.
const subscribeToLocale = () => () => {};

/** Displays game metadata and a responsive banner, with deletion controls for the owner. */
export default function GameCard({ game, canDelete, priority = false }: GameCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { username } = useContext(UserContext);
  const uploadDate = useSyncExternalStore(
    subscribeToLocale,
    () => game.uploadedAt.toLocaleDateString(),
    () => game.uploadedAt.toISOString().slice(0, 10),
  );

  /** Confirms deletion, authenticates the API request, and refreshes the list after success. */
  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent card click event
    if (!confirm('Are you sure you want to delete this game?')) return;

    setIsDeleting(true);
    try {
      // Get the current user's ID token
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user');
      }
      const idToken = await user.getIdToken();

      const response = await fetch(`/api/games/${game.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        let errorText = await response.text();
        try {
          const errorBody = JSON.parse(errorText);
          errorText =
            typeof errorBody?.error === 'string' ? errorBody.error : 'Failed to delete game';
        } catch {
          // Keep compatibility with older servers that return a plain-text error.
        }
        throw new Error(errorText || 'Failed to delete game');
      }

      // Refresh the page or update the UI
      window.location.reload();
    } catch (error) {
      console.error('Error deleting game:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete game');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="border-none bg-slate-800 flex flex-col justify-between items-stretch relative group min-h-[320px] pb-0">
      {/* Delete button absolutely positioned in top-right */}
      {canDelete && username === game.username && (
        <CardAction className="absolute top-2 right-2 z-10">
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition-opacity"
            aria-label="Delete game"
          >
            {isDeleting ? <span className="animate-spin">↻</span> : <span>×</span>}
          </button>
        </CardAction>
      )}
      <CardHeader className="flex flex-col justify-center">
        <CardTitle>
          <Link href={`/${game.username}/${game.slug}`}>{game.name}</Link>
        </CardTitle>
        <CardDescription className="text-center">
          Uploaded by <Link href={`/${game.username}`}>{game.username}</Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-center">
        <Banner
          home={`/${game.username}/${game.slug}`}
          img={game.bannerImageUrl}
          txt={game.name}
          priority={priority}
          sizes="(max-width: 800px) calc(100vw - 88px), 712px"
        />
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-2 rounded-b-xl border-t border-slate-700/60 bg-slate-900/20 pb-4 text-xs leading-5 text-slate-400 [.border-t]:pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="flex shrink-0 items-center gap-2 whitespace-nowrap">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          <span>
            Uploaded{' '}
            <time className="text-slate-300" dateTime={game.uploadedAt.toISOString()}>
              {uploadDate}
            </time>
          </span>
        </p>
        {game.copyright && (
          <p className="min-w-0 break-words sm:max-w-[60%] sm:text-right">© {game.copyright}</p>
        )}
      </CardFooter>
    </Card>
  );
}
