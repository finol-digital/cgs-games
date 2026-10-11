import Game from '@/lib/game';
import Link from 'next/link';
import { CalendarDays, CircleUserRound } from 'lucide-react';
import Banner from '@/components/banner';

import DeleteGameButton from '@/components/deleteGameButton';
import LocalDate from '@/components/localDate';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface GameCardProps {
  game: Game;
  canDelete: boolean;
  priority?: boolean;
}

/** Renders public game content on the server, with small interactive controls. */
export default function GameCard({ game, canDelete, priority = false }: GameCardProps) {
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
                className="rounded-sm text-slate-300! underline! underline-offset-2 hover:text-[#d3bd7a]! hover:underline! focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d3bd7a]"
              >
                {game.username}
              </Link>
            </span>
          </CardDescription>
        </div>
        {canDelete && <DeleteGameButton gameId={game.id} owner={game.username} />}
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
            Uploaded <LocalDate dateTime={game.uploadedAt.toISOString()} />
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
