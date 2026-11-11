'use client';

import { useContext, useEffect, useState } from 'react';
import { Check, Link as LinkIcon } from 'lucide-react';
import { UserContext } from '@/lib/context';
import { GameVisibility } from '@/lib/game';
import VisibilityToggle from '@/components/visibilityToggle';

interface GameShareActionsProps {
  gameId: string;
  owner: string;
  visibility: GameVisibility;
}

/** Lets any visitor copy the game's link, and lets its owner change the game's visibility. */
export default function GameShareActions({ gameId, owner, visibility }: GameShareActionsProps) {
  const { username } = useContext(UserContext);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  /** Copies the page's own URL, without any query string or fragment the visitor arrived with. */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + window.location.pathname);
      setCopied(true);
    } catch (error) {
      console.error('Error copying link:', error);
      alert('Failed to copy the link. Copy it from the address bar instead.');
    }
  };

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center">
      <button type="button" onClick={handleCopy} className="inline-flex items-center gap-2">
        {copied ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <LinkIcon className="size-4" aria-hidden="true" />
        )}
        <span aria-live="polite">{copied ? 'Link copied!' : 'Copy link'}</span>
      </button>
      {username === owner && (
        <VisibilityToggle gameId={gameId} visibility={visibility} variant="button" />
      )}
    </div>
  );
}
