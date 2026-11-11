'use client';

import { useState, type MouseEvent } from 'react';
import { Globe, LoaderCircle, Lock } from 'lucide-react';
import { auth } from '@/lib/firebase/firebase';
import { GameVisibility } from '@/lib/game';

interface VisibilityToggleProps {
  gameId: string;
  visibility: GameVisibility;
  /** A labeled button for the game page, or a compact icon button for game cards. */
  variant?: 'button' | 'icon';
}

/** Switches an owned game between public and private (unlisted), then reloads to show the result. */
export default function VisibilityToggle({
  gameId,
  visibility,
  variant = 'icon',
}: VisibilityToggleProps) {
  const [isSaving, setIsSaving] = useState(false);
  const target: GameVisibility = visibility === 'private' ? 'public' : 'private';
  const label = target === 'private' ? 'Make game private' : 'Make game public';

  /** Confirms publication, authenticates the API request, and refreshes the page after success. */
  const handleToggle = async (e: MouseEvent) => {
    e.preventDefault(); // Prevent card click event
    if (
      target === 'public' &&
      !confirm('Make this game public? It will be listed in Browse and on your profile.')
    )
      return;

    setIsSaving(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user');
      }
      const idToken = await user.getIdToken();

      const response = await fetch(`/api/games/${gameId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ visibility: target }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(
          typeof errorBody?.error === 'string'
            ? errorBody.error
            : 'Failed to update game visibility',
        );
      }

      // Keep the button busy until the reloaded page reflects the new visibility.
      window.location.reload();
    } catch (error) {
      console.error('Error updating game visibility:', error);
      alert(error instanceof Error ? error.message : 'Failed to update game visibility');
      setIsSaving(false);
    }
  };

  const Icon = isSaving ? LoaderCircle : visibility === 'private' ? Lock : Globe;
  const icon = <Icon className={isSaving ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />;

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={isSaving}
        className="inline-flex items-center gap-2"
      >
        {icon}
        <span>{label}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isSaving}
      className="m-0! flex size-11 items-center justify-center rounded-lg! bg-transparent! p-0! text-slate-400! hover:bg-slate-700/50! hover:text-slate-100! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300 disabled:cursor-wait"
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}
