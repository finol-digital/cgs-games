'use client';

import { useContext, useState, type MouseEvent } from 'react';
import { LoaderCircle, Trash2 } from 'lucide-react';
import { auth } from '@/lib/firebase/firebase';
import { UserContext } from '@/lib/context';
import { CardAction } from '@/components/ui/card';

interface DeleteGameButtonProps {
  gameId: string;
  owner: string;
}

/** Keeps owner-only deletion interactive without hydrating the entire game card. */
export default function DeleteGameButton({ gameId, owner }: DeleteGameButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { username } = useContext(UserContext);
  /** Confirms deletion, authenticates the API request, and refreshes the list after success. */
  const handleDelete = async (e: MouseEvent) => {
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

      const response = await fetch(`/api/games/${gameId}`, {
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

  if (username !== owner) return null;
  return (
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
  );
}
