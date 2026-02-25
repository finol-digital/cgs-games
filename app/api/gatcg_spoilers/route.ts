import { NextResponse } from 'next/server';
import { createScheduler, createWorker } from 'tesseract.js';
import sharp from 'sharp';
import { getCachedOcrResult, setCachedOcrResult } from '@/lib/firebase/admin';

const SILVIE_GG_HOST = 'https://silvie.gg';
const NUM_OCR_WORKERS = 4;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
// Approximate text box region on Grand Archive TCG cards (as percentage of card dimensions)
const TEXT_BOX = {
  topPct: 0.585,
  leftPct: 0.075,
  widthPct: 0.85,
  heightPct: 0.3,
};

// In-memory response cache keyed by `set` query param
const responseCache = new Map<string, { json: string; timestamp: number }>();

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const setParam = requestUrl.searchParams.get('set') ?? '34,35,36,37,38';
  if (!/^\d+(,\d+)*$/.test(setParam)) {
    return NextResponse.json({ error: 'Invalid set parameter' }, { status: 400 });
  }
  const noCache = requestUrl.searchParams.get('nocache') === '1';

  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Check in-memory cache (skip if nocache requested)
  if (!noCache) {
    const cached = responseCache.get(setParam);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log(`In-memory cache hit for set=${setParam}`);
      return new NextResponse(cached.json, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
        },
      });
    }
  }

  let data;
  try {
    data = await getData(setParam);
  } catch (error) {
    console.error('Failed to fetch GATCG spoilers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch spoiler data' },
      { status: 502, headers: corsHeaders },
    );
  }
  const json = JSON.stringify(data);

  // Store in in-memory cache unless nocache is requested
  if (!noCache) {
    responseCache.set(setParam, { json, timestamp: Date.now() });
  }

  return new NextResponse(json, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': noCache ? 'no-store' : 'public, s-maxage=86400, stale-while-revalidate=3600',
    },
  });
}

async function getData(setParam: string) {
  const url = new URL(`${SILVIE_GG_HOST}/api/spoilers?set=${setParam}`);
  console.log('Request /api/gatcg_spoilers GET ' + url);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Silvie.gg API returned ${response.status}: ${response.statusText}`);
  }
  const responseJson = await response.json();

  interface CardEntry {
    uuid: string;
    name: string;
    card_image_url: string;
    back_card_name: string;
    back_card_image_url: string;
    types: string[];
    element: string;
    effect_raw: string;
  }

  const dataContainer: { data: CardEntry[] } = { data: [] };

  for (let i = 0; i < responseJson.spoilers.length; i++) {
    const spoiler = responseJson.spoilers[i];
    const cardImageUrl = SILVIE_GG_HOST + spoiler.card_image_url.replace('/img/', '/api/images/');

    const entry: CardEntry = {
      uuid: '' + spoiler.id,
      name: spoiler.card_name as string,
      card_image_url: cardImageUrl,
      back_card_name: '',
      back_card_image_url: '',
      types: [],
      element: '',
      effect_raw: '',
    };

    if (spoiler.back_card && spoiler.back_card.card_name) {
      entry.back_card_name = spoiler.back_card.card_name;
      entry.back_card_image_url =
        SILVIE_GG_HOST + spoiler.back_card.card_image_url.replace('/img/', '/api/images/');
    }

    const cardType = spoiler.card_type;
    if (typeof cardType === 'string') {
      entry.types = [cardType.toUpperCase()];
    }

    const elementName = spoiler.element_name;
    if (typeof elementName === 'string') {
      entry.element = elementName.toUpperCase();
    }

    dataContainer.data.push(entry);
  }

  // Check Firestore cache for each card's OCR result
  const cacheResults = await Promise.all(
    dataContainer.data.map((entry) => getCachedOcrResult(entry.uuid, entry.card_image_url)),
  );

  // Separate cached vs uncached entries
  const uncachedIndices: number[] = [];
  cacheResults.forEach((cachedText, i) => {
    if (cachedText !== null) {
      dataContainer.data[i].effect_raw = cachedText;
    } else {
      uncachedIndices.push(i);
    }
  });

  console.log(
    `OCR cache: ${dataContainer.data.length - uncachedIndices.length} hits, ${
      uncachedIndices.length
    } misses`,
  );

  // Only run OCR for uncached cards
  if (uncachedIndices.length > 0) {
    const scheduler = await createOcrScheduler();
    try {
      // Process uncached cards in batches to avoid excessive concurrency
      for (let start = 0; start < uncachedIndices.length; start += NUM_OCR_WORKERS) {
        const batchIndices = uncachedIndices.slice(start, start + NUM_OCR_WORKERS);

        const ocrResults = await Promise.all(
          batchIndices.map((i) =>
            extractCardText(dataContainer.data[i].card_image_url, scheduler),
          ),
        );

        await Promise.all(
          ocrResults.map((text, idx) => {
            const i = batchIndices[idx];
            dataContainer.data[i].effect_raw = text;
            return setCachedOcrResult(
              dataContainer.data[i].uuid,
              dataContainer.data[i].card_image_url,
              text,
            );
          }),
        );
      }
    } finally {
      await scheduler.terminate();
    }
  }

  return dataContainer;
}

async function createOcrScheduler() {
  const scheduler = createScheduler();
  const workers = await Promise.all(
    Array.from({ length: NUM_OCR_WORKERS }, () => createWorker('eng')),
  );
  for (const w of workers) {
    scheduler.addWorker(w);
  }
  return scheduler;
}

async function extractCardText(
  imageUrl: string,
  scheduler: ReturnType<typeof createScheduler>,
): Promise<string> {
  try {
    const response = await fetch(imageUrl);
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
