'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Search, X } from 'lucide-react';
import { browseSearchHref, matchesGameSearch, SearchGame } from '@/lib/gameSearch';

/** Loads the public catalog on demand, then filters without per-keystroke requests. */
export default function HeaderSearch() {
  const router = useRouter();
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [query, setQuery] = useState('');
  const [games, setGames] = useState<SearchGame[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const matches = query.trim()
    ? (games || []).filter((game) => matchesGameSearch(game, query))
    : [];
  const suggestions = matches.slice(0, 5);
  const showResults = open && !!query.trim();
  const activeGame = showResults ? suggestions[activeIndex] : undefined;
  const browseHref = browseSearchHref(query);

  useEffect(() => {
    if (showResults && activeIndex >= 0) {
      document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [activeIndex, showResults, listId]);

  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('pointerdown', dismiss);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, []);

  async function loadCatalog() {
    if (games !== null || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setStatus('loading');
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch('/api/games', { signal: controller.signal });
      if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
      const data: unknown = await response.json();
      if (
        !Array.isArray(data) ||
        !data.every(
          (game) =>
            game &&
            ['id', 'name', 'username', 'slug'].every((key) => typeof game[key] === 'string'),
        )
      ) {
        throw new Error('Invalid catalog response');
      }
      if (requestRef.current !== controller) return;
      setGames(
        data.map((game) => ({
          id: game.id,
          name: game.name,
          username: game.username,
          slug: game.slug,
          copyright: typeof game.copyright === 'string' ? game.copyright : '',
          bannerImageUrl: typeof game.bannerImageUrl === 'string' ? game.bannerImageUrl : '',
        })),
      );
      setStatus('ready');
    } catch (error) {
      if (requestRef.current !== controller) return;
      console.error('Failed to load search suggestions:', error);
      setStatus('error');
    } finally {
      clearTimeout(timeout);
      if (requestRef.current === controller) requestRef.current = null;
    }
  }

  function dismiss() {
    setOpen(false);
    setActiveIndex(-1);
  }

  return (
    <div
      ref={containerRef}
      className="relative order-last w-full min-w-0 lg:order-none lg:mx-4 lg:max-w-md lg:flex-1"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) dismiss();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          dismiss();
        }
      }}
    >
      <form
        action="/browse"
        role="search"
        aria-label="Find a game"
        onSubmit={(event) => {
          event.preventDefault();
          dismiss();
          router.push(activeGame ? `/${activeGame.username}/${activeGame.slug}` : browseHref);
        }}
        className="flex h-11 items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 text-slate-100 focus-within:ring-2 focus-within:ring-[#432e16]"
      >
        <Search className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
        <input
          ref={inputRef}
          name="q"
          type="text"
          role="combobox"
          aria-label="Search games"
          aria-autocomplete="list"
          aria-expanded={showResults}
          aria-controls={showResults ? listId : undefined}
          aria-activedescendant={activeGame ? `${listId}-${activeIndex}` : undefined}
          autoComplete="off"
          placeholder="Search games…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
            if (event.target.value.trim()) void loadCatalog();
          }}
          onFocus={() => {
            setOpen(true);
            if (query.trim()) void loadCatalog();
          }}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            event.preventDefault();
            setOpen(true);
            if (!suggestions.length) return;
            setActiveIndex((index) =>
              event.key === 'ArrowDown'
                ? Math.min(index + 1, suggestions.length - 1)
                : Math.max(index - 1, -1),
            );
          }}
          className="min-w-0 flex-1 bg-transparent py-2 text-base text-slate-100 outline-none placeholder:text-slate-400 lg:text-sm"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery('');
              dismiss();
              inputRef.current?.focus();
            }}
            className="m-0! flex size-8 shrink-0 items-center justify-center bg-transparent! p-0! text-slate-300! focus-visible:outline-2 focus-visible:outline-[#d3bd7a]"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </form>
      {showResults && (
        <div className="absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-xl border border-slate-600 bg-slate-800 text-slate-100 shadow-xl">
          <p role="status" className="px-4 pt-3 pb-2 text-sm text-slate-300">
            {status === 'loading'
              ? 'Loading games…'
              : status === 'error'
                ? 'Search suggestions are unavailable. Try again or search in Browse.'
                : matches.length
                  ? `${matches.length} ${matches.length === 1 ? 'game' : 'games'} found`
                  : 'No games found. Try another name or creator.'}
          </p>
          {status === 'error' && (
            <button
              type="button"
              onClick={() => void loadCatalog()}
              className="mx-4! my-2! rounded px-3! py-2! focus-visible:outline-2 focus-visible:outline-[#d3bd7a]"
            >
              Try again
            </button>
          )}
          <ul
            id={listId}
            role="listbox"
            aria-label="Matching games"
            className="max-h-72 overflow-y-auto"
          >
            {suggestions.map((game, index) => (
              <li key={game.id} role="presentation">
                <Link
                  id={`${listId}-${index}`}
                  href={`/${game.username}/${game.slug}`}
                  prefetch={false}
                  role="option"
                  aria-selected={activeIndex === index}
                  tabIndex={-1}
                  onClick={dismiss}
                  className={`flex items-center gap-3 px-4 py-3 text-slate-100! no-underline! hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-[#d3bd7a] ${activeIndex === index ? 'bg-slate-700' : ''}`}
                >
                  <img
                    src={
                      /^https:\/\//i.test(game.bannerImageUrl)
                        ? `/api/proxy/${game.bannerImageUrl.slice(8)}`
                        : '/CardBack.png'
                    }
                    alt=""
                    width={40}
                    height={48}
                    loading="lazy"
                    onError={(event) => {
                      if (event.currentTarget.getAttribute('src') !== '/CardBack.png') {
                        event.currentTarget.src = '/CardBack.png';
                      }
                    }}
                    className="h-12 w-10 shrink-0 rounded bg-slate-900 object-contain"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold [overflow-wrap:anywhere]">
                      {game.name}
                    </span>
                    <span className="block text-xs text-slate-300 [overflow-wrap:anywhere]">
                      by {game.username}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={browseHref}
            prefetch={false}
            onClick={dismiss}
            className="flex items-center justify-between gap-3 border-t border-slate-600 px-4 py-3 text-sm text-[#d3bd7a]! no-underline! hover:bg-slate-700 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#d3bd7a]"
          >
            See all results in Browse <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}
