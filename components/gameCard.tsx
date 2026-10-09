'use client';

import React from 'react';

import { auth } from '@/lib/firebase/firebase';
import Game from '@/lib/game';
import Link from 'next/link';
import { useContext, useState, useSyncExternalStore } from 'react';
import { CalendarDays, CircleUserRound, LoaderCircle, Trash2 } from 'lucide-react';
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
    <Card className="gap-0 overflow-hidden rounded-2xl border-slate-700/60 bg-slate-800 py-0 shadow-sm transition-colors hover:border-slate-600 focus-within:border-slate-500">
      <CardHeader className="flex flex-row items-start gap-4 px-6 py-5">
        <div className="min-w-0 flex-1">
          <CardTitle>
            <h2 className="text-lg leading-snug font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-xl">
              <Link
                href={`/${game.username}/${game.slug}`}
                className="rounded-sm text-slate-100! no-underline! hover:text-[#d3bd7a]! focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d3bd7a]"
              >
                {game.name}
              </Link>
            </h2>
          </CardTitle>
          <CardDescription className="mt-2 flex items-start gap-2 text-xs leading-5 text-slate-400">
            <CircleUserRound className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 [overflow-wrap:anywhere]">
              Uploaded by{' '}
              <Link
                href={`/${game.username}`}
                className="rounded-sm text-slate-300! no-underline! hover:text-[#d3bd7a]! hover:underline! focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d3bd7a]"
              >
                {game.username}
              </Link>
            </span>
          </CardDescription>
        </div>
        {canDelete && username === game.username && (
          <CardAction className="shrink-0">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="m-0! flex size-11 items-center justify-center rounded-lg! bg-transparent! p-0! text-slate-400! hover:bg-red-950/50! hover:text-red-300! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300 disabled:cursor-wait"
              aria-label="Delete game"
              title="Delete game"
            >
              {isDeleting ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-4" aria-hidden="true" />
              )}
            </button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="px-6 pb-5">
        <Banner
          home={`/${game.username}/${game.slug}`}
          img={game.bannerImageUrl}
          txt={game.name}
          priority={priority}
          sizes="(max-width: 800px) calc(100vw - 120px), 680px"
          className="h-44 rounded-xl bg-slate-900/40 p-4 sm:h-48"
        />
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-2 border-t border-slate-700/60 bg-slate-900/20 px-6 pb-4 text-xs leading-5 text-slate-400 [.border-t]:pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
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
          <p className="flex min-w-0 items-start gap-1 sm:max-w-[60%] sm:text-right">
            <span className="shrink-0">©</span>
            <span className="min-w-0 [overflow-wrap:anywhere]">{game.copyright}</span>
          </p>
        )}
      </CardFooter>
    </Card>
  );
}
