import sharp from 'sharp';
import { createScheduler, createWorker } from 'tesseract.js';

import {
  getCachedOcrResults,
  setCachedOcrResults,
  type OcrCacheResult,
} from '@/lib/firebase/admin';

const SILVIE_GG_HOST = 'https://silvie.gg';
const SILVIE_GG_DOMAIN = 'silvie.gg';
const MAX_OCR_WORKERS = 4;

const UPSTREAM_FETCH_TIMEOUT_MS = 10_000;
const IMAGE_FETCH_TIMEOUT_MS = 10_000;

/** Time held back after the last OCR batch to persist results and respond. */
const WRITE_RESERVE_MS = 2_000;
/** Assumed cost of spinning up the tesseract workers before the first batch. */
const SCHEDULER_INIT_ESTIMATE_MS = 8_000;
/** Assumed cost of the first OCR batch; later batches use the measured cost. */
const INITIAL_BATCH_ESTIMATE_MS = 8_000;
/** Floor for the measured batch cost, so a fast batch can't shrink the guard. */
const MIN_BATCH_ESTIMATE_MS = 2_000;

// Approximate text box region on Grand Archive TCG cards (as percentage of card dimensions)
const TEXT_BOX = {
  topPct: 0.585,
  leftPct: 0.075,
  widthPct: 0.85,
  heightPct: 0.3,
};

export interface CardEntry {
  uuid: string;
  name: string;
  card_image_url: string;
  back_card_name: string;
  back_card_image_url: string;
  types: string[];
  element: string;
  effect_raw: string;
}

export interface SpoilerData {
  data: CardEntry[];
}

export interface BuildSpoilerDataOptions {
  /**
   * Absolute wall-clock time (epoch ms) by which the build must be finished.
   * Cards that cannot be OCR'd within the budget are returned with empty text
   * and picked up by a later request or a warm run. Defaults to no budget,
   * which is only appropriate for cache warming.
   */
  deadline?: number;
  /** Re-run OCR even for cards that already have usable cached text. */
  refreshOcr?: boolean;
}

export interface BuildSpoilerDataResult {
  data: SpoilerData;
  cardCount: number;
  /** Cards whose text came from the Firestore OCR cache. */
  ocrHits: number;
  /** Cards OCR'd during this build. */
  ocrRan: number;
  /** Cards left without text because the budget ran out. */
  ocrPending: number;
}

interface SilvieSpoiler {
  id: number | string;
  card_name?: string;
  card_image_url?: string;
  card_image_slug?: string;
  card_type?: string;
  element_name?: string;
  back_card?: { card_name?: string; card_image_url?: string; card_image_slug?: string } | null;
}

/** Hosts whose images this route is willing to fetch and hand to clients. */
function isSilvieHost(hostname: string): boolean {
  return hostname === SILVIE_GG_DOMAIN || hostname.endsWith(`.${SILVIE_GG_DOMAIN}`);
}

/**
 * Resolve the URL a spoiler card image is actually served from.
 *
 * The API reports images under `/img/spoilers/...`, but that path only has
 * static files for older sets: images for the set currently being spoiled are
 * served by silvie.gg's `/api/images/spoilers/...` route and 404 under `/img`.
 * The API route serves every set, so it is used for all of them.
 *
 * The URL is parsed rather than prefix-matched, and its host checked against
 * the registrable domain: a look-alike such as `https://silvie.gg.example.com`
 * starts with the expected prefix but must not be fetched or served onwards.
 * Anything off-domain is dropped instead of passed through.
 */
function resolveImageUrl(spoiler: { card_image_url?: string; card_image_slug?: string }): string {
  const raw = spoiler.card_image_slug ?? spoiler.card_image_url ?? '';
  if (!raw) return '';

  let url: URL;
  try {
    // Slugs are relative and card_image_url is absolute; resolving against the
    // known origin handles both, and percent-encodes set folders that contain
    // spaces (e.g. "MRC Alter").
    url = new URL(raw, SILVIE_GG_HOST);
  } catch {
    console.warn(`Ignoring unparseable spoiler image URL: ${raw}`);
    return '';
  }

  if (url.protocol !== 'https:' || !isSilvieHost(url.hostname)) {
    console.warn(`Ignoring spoiler image on unexpected origin: ${url.origin}`);
    return '';
  }

  if (url.pathname.startsWith('/img/')) {
    url.pathname = `/api/images/${url.pathname.slice('/img/'.length)}`;
  }

  return url.toString();
}

/**
 * Build an AbortSignal that respects both a per-request cap and the overall
 * deadline, so no single fetch can overrun the budget.
 */
function timeoutSignal(deadline: number, maxMs: number): AbortSignal {
  const remaining = deadline - Date.now();
  const timeout = Number.isFinite(remaining) ? Math.min(maxMs, remaining) : maxMs;
  return AbortSignal.timeout(Math.max(1, timeout));
}

async function fetchSpoilerEntries(deadline: number): Promise<CardEntry[]> {
  const url = new URL(`${SILVIE_GG_HOST}/api/spoilers?current=true`);
  console.log('Fetching GATCG spoilers from ' + url);

  const response = await fetch(url, { signal: timeoutSignal(deadline, UPSTREAM_FETCH_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`Silvie.gg API returned ${response.status}: ${response.statusText}`);
  }

  const responseJson = (await response.json()) as { spoilers?: SilvieSpoiler[] };
  const spoilers = responseJson.spoilers ?? [];

  return spoilers.map((spoiler) => {
    const entry: CardEntry = {
      uuid: '' + spoiler.id,
      name: spoiler.card_name ?? '',
      card_image_url: resolveImageUrl(spoiler),
      back_card_name: '',
      back_card_image_url: '',
      types: [],
      element: '',
      effect_raw: '',
    };

    if (spoiler.back_card && spoiler.back_card.card_name) {
      entry.back_card_name = spoiler.back_card.card_name;
      entry.back_card_image_url = resolveImageUrl(spoiler.back_card);
    }

    if (typeof spoiler.card_type === 'string') {
      entry.types = [spoiler.card_type.toUpperCase()];
    }

    if (typeof spoiler.element_name === 'string') {
      entry.element = spoiler.element_name.toUpperCase();
    }

    return entry;
  });
}

/**
 * Fetch the current spoiler list and fill in card text, using the Firestore
 * OCR cache first and only OCR'ing what is missing, within the given budget.
 */
export async function buildSpoilerData(
  options: BuildSpoilerDataOptions = {},
): Promise<BuildSpoilerDataResult> {
  const deadline = options.deadline ?? Number.POSITIVE_INFINITY;
  const entries = await fetchSpoilerEntries(deadline);

  const cachedText = options.refreshOcr
    ? new Map<string, string>()
    : await getCachedOcrResults(
        entries.map((entry) => ({ spoilerId: entry.uuid, imageUrl: entry.card_image_url })),
      );

  const needsOcr: number[] = [];
  let ocrHits = 0;

  entries.forEach((entry, index) => {
    const text = cachedText.get(entry.uuid);
    if (text !== undefined) {
      entry.effect_raw = text;
      ocrHits++;
    } else if (entry.card_image_url) {
      needsOcr.push(index);
    }
  });

  const ocrRan = needsOcr.length > 0 ? await runOcr(entries, needsOcr, deadline) : 0;

  console.log(
    `GATCG spoilers: ${entries.length} cards, OCR ${ocrHits} cached / ${ocrRan} extracted / ${
      needsOcr.length - ocrRan
    } deferred`,
  );

  return {
    data: { data: entries },
    cardCount: entries.length,
    ocrHits,
    ocrRan,
    ocrPending: needsOcr.length - ocrRan,
  };
}

/**
 * OCR the given entries in place, batch by batch, stopping as soon as another
 * batch would not fit in the remaining budget. Each batch is persisted as it
 * completes so partial progress survives, and the next request resumes where
 * this one left off.
 */
async function runOcr(entries: CardEntry[], needsOcr: number[], deadline: number): Promise<number> {
  const remaining = deadline - Date.now();
  if (remaining <= SCHEDULER_INIT_ESTIMATE_MS + INITIAL_BATCH_ESTIMATE_MS + WRITE_RESERVE_MS) {
    console.log(`Skipping OCR of ${needsOcr.length} card(s): not enough time budget remaining`);
    return 0;
  }

  const workerCount = Math.min(MAX_OCR_WORKERS, needsOcr.length);
  const scheduler = await createOcrScheduler(workerCount);
  let ocrRan = 0;

  try {
    let batchEstimateMs = INITIAL_BATCH_ESTIMATE_MS;

    for (let start = 0; start < needsOcr.length; start += workerCount) {
      if (Date.now() + batchEstimateMs + WRITE_RESERVE_MS > deadline) {
        console.log(`OCR budget exhausted; deferring ${needsOcr.length - start} card(s)`);
        break;
      }

      const batchStartedAt = Date.now();
      const batch = needsOcr.slice(start, start + workerCount);
      const texts = await Promise.all(
        batch.map((index) => extractCardText(entries[index].card_image_url, scheduler, deadline)),
      );
      batchEstimateMs = Math.max(Date.now() - batchStartedAt, MIN_BATCH_ESTIMATE_MS);

      const writes: OcrCacheResult[] = batch.map((index, batchIndex) => {
        entries[index].effect_raw = texts[batchIndex];
        return {
          spoilerId: entries[index].uuid,
          imageUrl: entries[index].card_image_url,
          effectRaw: texts[batchIndex],
        };
      });
      ocrRan += batch.length;

      // Cache failures too, so an unreadable card can't burn every request's
      // budget; getCachedOcrResults retries them after a backoff.
      await setCachedOcrResults(writes);
    }
  } finally {
    await scheduler.terminate();
  }

  return ocrRan;
}

async function createOcrScheduler(workerCount: number) {
  const scheduler = createScheduler();
  const workers = await Promise.all(Array.from({ length: workerCount }, () => createWorker('eng')));
  for (const w of workers) {
    scheduler.addWorker(w);
  }
  return scheduler;
}

async function extractCardText(
  imageUrl: string,
  scheduler: ReturnType<typeof createScheduler>,
  deadline: number,
): Promise<string> {
  try {
    const response = await fetch(imageUrl, {
      signal: timeoutSignal(deadline, IMAGE_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return '';

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    if (width === 0 || height === 0) return '';

    const croppedBuffer = await sharp(imageBuffer)
      .extract({
        left: Math.floor(width * TEXT_BOX.leftPct),
        top: Math.floor(height * TEXT_BOX.topPct),
        width: Math.floor(width * TEXT_BOX.widthPct),
        height: Math.floor(height * TEXT_BOX.heightPct),
      })
      .greyscale()
      .normalize()
      .sharpen()
      .toBuffer();

    const {
      data: { text },
    } = await scheduler.addJob('recognize', croppedBuffer);

    return text.replace(/\n{2,}/g, '\n').trim();
  } catch (error) {
    console.error(`OCR failed for ${imageUrl}:`, error);
    return '';
  }
}
