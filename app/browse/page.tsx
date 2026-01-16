'use client';

import Footer from '@/components/footer';
import GamesDeck from '@/components/gamesDeck';
import { getAllGames } from '@/lib/firebase/firestore';
import Game from '@/lib/game';
import { useState, useEffect } from 'react';

export default function Page() {
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const games = await getAllGames();
        setAllGames(games);
      } catch (error) {
        console.error('Error fetching games:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchGames();
  }, []);

  const filteredGames = allGames.filter((game) => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    return (
      (game.name && game.name.toLowerCase().includes(query)) ||
      (game.username && game.username.toLowerCase().includes(query)) ||
      (game.slug && game.slug.toLowerCase().includes(query)) ||
      (game.copyright && game.copyright.toLowerCase().includes(query))
    );
  });

  const resultCount = filteredGames.length;

  return (
    <>
      <main className="main-content">
        <h1 className="text-center text-4xl font-bold my-4">CGS Games Browser</h1>

        <div className="max-w-2xl mx-auto mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search games by name, creator, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 pl-10 text-white bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400"
            />
            <svg
              className="absolute left-3 top-3.5 h-5 w-5 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {searchQuery && (
            <p className="mt-2 text-center text-slate-400">
              {resultCount} {resultCount === 1 ? 'game' : 'games'} found matching &quot;
              {searchQuery}&quot;
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <p className="text-slate-400">Loading games...</p>
          </div>
        ) : (
          <GamesDeck games={filteredGames} />
        )}
      </main>
      <Footer />
    </>
  );
}
