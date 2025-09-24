'use client';

import React from 'react';

import { auth } from '@/lib/firebase/firebase';
import Game from '@/lib/game';
import { Card, CardBody, CardFooter } from '@heroui/card';
import Link from 'next/link';
import { useContext, useState } from 'react';
import Banner from './banner';

import { UserContext } from '@/lib/context';

export default function GameCard({
  game,
  key,
  canDelete,
}: {
  game: Game;
  key: any;
  canDelete: boolean;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { username } = useContext(UserContext);

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
        const errorText = await response.text();
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
    <Card key={key} className="border-none bg-slate-800 flex items-center relative group">
      {canDelete && username === game.username && (
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
          aria-label="Delete game"
        >
          {isDeleting ? <span className="animate-spin">↻</span> : <span>×</span>}
        </button>
      )}
      <CardBody>
        <center>
          <Banner
            home={`/${game.username}/${game.slug}`}
            img={game.bannerImageUrl}
            txt={game.name}
          />
        </center>
      </CardBody>
      <CardFooter className="justify-between text-small text-white">
        {game.copyright && <p className="ml-4 mr-4">Copyright of {game.copyright}</p>}
        <p className="ml-4 mr-4">
          Uploaded by <Link href={`/${game.username}`}>{game.username}</Link>
        </p>
      </CardFooter>
    </Card>
  );
}
