import { NextResponse } from 'next/server';
import { createScheduler, createWorker } from 'tesseract.js';
import sharp from 'sharp';

// Approximate text box region on Grand Archive TCG cards (as percentage of card dimensions)
const TEXT_BOX = {
  topPct: 0.585,
  leftPct: 0.075,
  widthPct: 0.85,
  heightPct: 0.3,
};

const NUM_OCR_WORKERS = 4;

async function createOcrScheduler() {
  const scheduler = createScheduler();
  const workers = await Promise.all(
    Array.from({ length: NUM_OCR_WORKERS }, () => createWorker('eng')),
  );
  workers.forEach((w) => scheduler.addWorker(w));
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

export async function GET(request: Request) {
  const data = await getData(request);
  console.log(data);
  return new NextResponse(JSON.stringify(data), {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

async function getData(request: Request) {
  const silvieHost = 'https://silvie.gg';
  const requestUrl = new URL(request.url);
  const setParam = requestUrl.searchParams.get('set') ?? '34,35,36,37,38';
  const url = new URL(`${silvieHost}/api/spoilers?set=${setParam}`);
  console.log('Request /api/gatcg_spoilers GET ' + url);
  const response = await fetch(url);
  const responseJson = await response.json();
  console.log(responseJson);

  const scheduler = await createOcrScheduler();

  const dataContainer: {
    data: {
      uuid: string;
      name: string;
      card_image_url: string;
      back_card_name: string;
      back_card_image_url: string;
      types: string[];
      element: string;
      effect_raw: string;
    }[];
  } = {
    data: [],
  };

  for (let i = 0; i < responseJson.spoilers.length; i++) {
    const spoiler = responseJson.spoilers[i];
    const cardImageUrl = silvieHost + spoiler.card_image_url.replace('/img/', '/api/images/');

    const entry = {
      uuid: '' + spoiler.id,
      name: spoiler.card_name as string,
      card_image_url: cardImageUrl,
      back_card_name: '',
      back_card_image_url: '',
      types: [] as string[],
      element: '',
      effect_raw: '',
    };

    if (spoiler.back_card && spoiler.back_card.card_name) {
      entry.back_card_name = spoiler.back_card.card_name;
      entry.back_card_image_url =
        silvieHost + spoiler.back_card.card_image_url.replace('/img/', '/api/images/');
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

  // OCR all card images in parallel using the scheduler
  try {
    const ocrPromises = dataContainer.data.map((entry) =>
      extractCardText(entry.card_image_url, scheduler),
    );
    const ocrResults = await Promise.all(ocrPromises);
    ocrResults.forEach((text, i) => {
      dataContainer.data[i].effect_raw = text;
    });
  } finally {
    await scheduler.terminate();
  }

  return dataContainer;
}
