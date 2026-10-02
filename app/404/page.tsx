import { notFound } from 'next/navigation';

/** Renders the shared not-found UI at the proxy's internal rewrite destination. */
export default function MissingPage() {
  notFound();
}
