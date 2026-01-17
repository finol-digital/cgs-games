'use client';

import { useState } from 'react';
import Game from '@/lib/game';
import GamesDeck from './gamesDeck';

export default function BrowseGames({ games }: { games: Game[] }) {
  const [searchQuery, setSearchQuery] = useState('');

  // Normalize the search query once
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredGames = games.filter((game) => {
    if (!normalizedQuery) return true;

    return (
      (game.name && game.name.toLowerCase().includes(normalizedQuery)) ||
      (game.username && game.username.toLowerCase().includes(normalizedQuery)) ||
      (game.slug && game.slug.toLowerCase().includes(normalizedQuery)) ||
      (game.copyright && game.copyright.toLowerCase().includes(normalizedQuery))
    );
  });

  const resultCount = filteredGames.length;

  return (
    <>
      <div className="max-w-2xl mx-auto mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search games by name, creator, or keywords..."
            aria-label="Search games"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 pl-10 text-white bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400"
          />
          <svg
            className="absolute left-3 top-3.5 h-5 w-5 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {searchQuery.trim() && (
          <p className="mt-2 text-center text-slate-400">
            {resultCount} {resultCount === 1 ? 'game' : 'games'} found matching &quot;
            {normalizedQuery}&quot;
          </p>
        )}
      </div>

      <GamesDeck games={filteredGames} />
    </>
  );
}
