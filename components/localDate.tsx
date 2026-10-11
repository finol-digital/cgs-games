'use client';

import { useSyncExternalStore } from 'react';

interface LocalDateProps {
  dateTime: string;
}

// Locale formatting has no subscription; React switches snapshots after hydration.
const subscribeToLocale = () => () => {};

/** Preserves a stable server date and localizes only this text after hydration. */
export default function LocalDate({ dateTime }: LocalDateProps) {
  const label = useSyncExternalStore(
    subscribeToLocale,
    () => new Date(dateTime).toLocaleDateString(),
    () => dateTime.slice(0, 10),
  );

  return (
    <time className="text-slate-300" dateTime={dateTime}>
      {label}
    </time>
  );
}
