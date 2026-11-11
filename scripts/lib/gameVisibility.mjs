import { FieldPath } from 'firebase-admin/firestore';

/** Documents read per page while scanning the games collection. */
export const BACKFILL_PAGE_SIZE = 500;

/**
 * The visibility a stored game should be given so catalog queries can filter on it, or null when
 * it already has one. Anything but an explicit 'private' has always been listed publicly.
 */
export function backfilledVisibility(data) {
  return data.visibility === 'public' || data.visibility === 'private' ? null : 'public';
}

/**
 * Sets `visibility: 'public'` on every games document without a valid visibility. Without `write`
 * it only reports what it would change. Each update is conditioned on the document being unchanged
 * since it was read, so a game made private meanwhile is never published; rerun to retry those.
 */
export async function backfillGameVisibility(db, { write = false, pageSize = BACKFILL_PAGE_SIZE }) {
  const games = db.collection('games');
  const stale = [];
  let scanned = 0;
  let cursor;
  for (;;) {
    const page = games.orderBy(FieldPath.documentId()).select('visibility').limit(pageSize);
    const snapshot = await (cursor ? page.startAfter(cursor) : page).get();
    scanned += snapshot.docs.length;
    for (const doc of snapshot.docs) {
      const visibility = backfilledVisibility(doc.data());
      if (visibility) stale.push({ doc, visibility });
    }
    if (snapshot.docs.length < pageSize) break;
    cursor = snapshot.docs[snapshot.docs.length - 1];
  }

  const summary = {
    mode: write ? 'write' : 'dry-run',
    scanned,
    missingVisibility: stale.filter(({ doc }) => doc.data().visibility === undefined).length,
    invalidVisibility: stale.filter(({ doc }) => doc.data().visibility !== undefined).length,
    updated: 0,
    failed: [],
  };
  if (!write || !stale.length) return summary;

  const writer = db.bulkWriter();
  const writes = stale.map(({ doc, visibility }) =>
    writer.update(doc.ref, { visibility }, { lastUpdateTime: doc.updateTime }).then(
      () => summary.updated++,
      (error) => summary.failed.push({ gameId: doc.id, code: error.code ?? 'unknown' }),
    ),
  );
  await writer.close();
  await Promise.all(writes);
  return summary;
}

/** Counts games that catalog queries would miss: those without a valid visibility. */
export async function countGamesWithoutVisibility(db) {
  const games = db.collection('games');
  const [all, valid] = await Promise.all([
    games.count().get(),
    games.where('visibility', 'in', ['public', 'private']).count().get(),
  ]);
  return all.data().count - valid.data().count;
}
