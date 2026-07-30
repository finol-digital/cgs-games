import { buildSpoilerData } from '@/lib/gatcgSpoilers';
import { getCachedOcrResults, setCachedOcrResults } from '@/lib/firebase/admin';

jest.mock('@/lib/firebase/admin', () => ({
  getCachedOcrResults: jest.fn(),
  setCachedOcrResults: jest.fn(),
}));

const recognizeMock = jest.fn();
const terminateMock = jest.fn();

jest.mock('tesseract.js', () => ({
  createScheduler: jest.fn(() => ({
    addWorker: jest.fn(),
    addJob: (...args: unknown[]) => recognizeMock(...args),
    terminate: () => terminateMock(),
  })),
  createWorker: jest.fn(async () => ({})),
}));

jest.mock('sharp', () =>
  jest.fn(() => ({
    metadata: jest.fn(async () => ({ width: 100, height: 200 })),
    extract: jest.fn().mockReturnThis(),
    greyscale: jest.fn().mockReturnThis(),
    normalize: jest.fn().mockReturnThis(),
    sharpen: jest.fn().mockReturnThis(),
    toBuffer: jest.fn(async () => Buffer.from('cropped')),
  })),
);

const getCachedOcrResultsMock = getCachedOcrResults as jest.Mock;
const setCachedOcrResultsMock = setCachedOcrResults as jest.Mock;

const spoiler = (id: number, name: string) => ({
  id,
  card_name: name,
  card_image_slug: `/img/spoilers/PRD/card-${id}.jpg`,
  card_image_url: `https://silvie.gg/img/spoilers/PRD/card-${id}.jpg`,
  card_type: 'Item',
  element_name: 'Fire',
  back_card: null,
});

/** Where the card above is actually served from. */
const imageUrl = (id: number) => `https://silvie.gg/api/images/spoilers/PRD/card-${id}.jpg`;

const mockUpstream = (spoilers: ReturnType<typeof spoiler>[]) => {
  global.fetch = jest.fn(async (input: unknown) => {
    if (String(input).includes('/api/spoilers')) {
      return { ok: true, json: async () => ({ spoilers }) };
    }
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
  }) as unknown as typeof fetch;
};

describe('buildSpoilerData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setCachedOcrResultsMock.mockResolvedValue(undefined);
    recognizeMock.mockResolvedValue({ data: { text: 'extracted text' } });
  });

  it('maps upstream spoilers onto card entries', async () => {
    mockUpstream([spoiler(1, 'CookTech Mixer')]);
    getCachedOcrResultsMock.mockResolvedValue(new Map([['1', 'cached text']]));

    const result = await buildSpoilerData();

    expect(result.data.data).toEqual([
      {
        uuid: '1',
        name: 'CookTech Mixer',
        card_image_url: imageUrl(1),
        back_card_name: '',
        back_card_image_url: '',
        types: ['ITEM'],
        element: 'FIRE',
        effect_raw: 'cached text',
      },
    ]);
  });

  describe('image URLs', () => {
    // /img/spoilers only has static files for older sets; the set currently
    // being spoiled is served solely by the /api/images route.
    it('rewrites /img/spoilers paths onto the /api/images route', async () => {
      mockUpstream([spoiler(1, 'One')]);
      getCachedOcrResultsMock.mockResolvedValue(new Map([['1', 'text']]));

      const result = await buildSpoilerData();

      expect(result.data.data[0].card_image_url).toBe(
        'https://silvie.gg/api/images/spoilers/PRD/card-1.jpg',
      );
    });

    it('rewrites the absolute card_image_url when no slug is provided', async () => {
      mockUpstream([
        {
          id: 7,
          card_name: 'No Slug',
          card_image_url: 'https://silvie.gg/img/spoilers/HVN/arcane-blast.png',
          card_type: 'Action',
          element_name: 'Fire',
          back_card: null,
        } as never,
      ]);
      getCachedOcrResultsMock.mockResolvedValue(new Map([['7', 'text']]));

      const result = await buildSpoilerData();

      expect(result.data.data[0].card_image_url).toBe(
        'https://silvie.gg/api/images/spoilers/HVN/arcane-blast.png',
      );
    });

    it('encodes set folders containing spaces', async () => {
      mockUpstream([
        {
          id: 8,
          card_name: 'Altered',
          card_image_slug: '/img/spoilers/MRC Alter/prima-materia.jpg',
          card_type: 'Item',
          element_name: 'Norm',
          back_card: null,
        } as never,
      ]);
      getCachedOcrResultsMock.mockResolvedValue(new Map([['8', 'text']]));

      const result = await buildSpoilerData();

      expect(result.data.data[0].card_image_url).toBe(
        'https://silvie.gg/api/images/spoilers/MRC%20Alter/prima-materia.jpg',
      );
    });

    it('resolves back card images too', async () => {
      mockUpstream([
        {
          id: 9,
          card_name: 'Front',
          card_image_slug: '/img/spoilers/PRD/front.jpg',
          card_type: 'Champion',
          element_name: 'Water',
          back_card: { card_name: 'Back', card_image_slug: '/img/spoilers/PRD/back.jpg' },
        } as never,
      ]);
      getCachedOcrResultsMock.mockResolvedValue(new Map([['9', 'text']]));

      const result = await buildSpoilerData();

      expect(result.data.data[0].back_card_name).toBe('Back');
      expect(result.data.data[0].back_card_image_url).toBe(
        'https://silvie.gg/api/images/spoilers/PRD/back.jpg',
      );
    });

    it('leaves cards with no image alone', async () => {
      mockUpstream([{ id: 10, card_name: 'Imageless', back_card: null } as never]);
      getCachedOcrResultsMock.mockResolvedValue(new Map());

      const result = await buildSpoilerData({ deadline: Date.now() + 60_000 });

      expect(result.data.data[0].card_image_url).toBe('');
      expect(recognizeMock).not.toHaveBeenCalled();
      expect(result.ocrPending).toBe(0);
    });
  });

  it('runs no OCR at all when every card is cached', async () => {
    mockUpstream([spoiler(1, 'One'), spoiler(2, 'Two')]);
    getCachedOcrResultsMock.mockResolvedValue(
      new Map([
        ['1', 'text one'],
        ['2', 'text two'],
      ]),
    );

    const result = await buildSpoilerData({ deadline: Date.now() + 30_000 });

    expect(recognizeMock).not.toHaveBeenCalled();
    expect(setCachedOcrResultsMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ cardCount: 2, ocrHits: 2, ocrRan: 0, ocrPending: 0 });
  });

  it('only OCRs the cards missing from the cache, and persists them', async () => {
    mockUpstream([spoiler(1, 'One'), spoiler(2, 'Two')]);
    getCachedOcrResultsMock.mockResolvedValue(new Map([['1', 'text one']]));

    const result = await buildSpoilerData({ deadline: Date.now() + 60_000 });

    expect(recognizeMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ ocrHits: 1, ocrRan: 1, ocrPending: 0 });
    expect(result.data.data[1].effect_raw).toBe('extracted text');
    expect(setCachedOcrResultsMock).toHaveBeenCalledWith([
      {
        spoilerId: '2',
        imageUrl: imageUrl(2),
        effectRaw: 'extracted text',
      },
    ]);
  });

  it('defers OCR instead of overrunning the deadline', async () => {
    mockUpstream([spoiler(1, 'One'), spoiler(2, 'Two')]);
    getCachedOcrResultsMock.mockResolvedValue(new Map());

    const result = await buildSpoilerData({ deadline: Date.now() + 500 });

    expect(recognizeMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ cardCount: 2, ocrHits: 0, ocrRan: 0, ocrPending: 2 });
    expect(result.data.data.every((entry) => entry.effect_raw === '')).toBe(true);
  });

  it('caches failed OCR so it is not retried on every request', async () => {
    mockUpstream([spoiler(1, 'One')]);
    getCachedOcrResultsMock.mockResolvedValue(new Map());
    recognizeMock.mockRejectedValue(new Error('tesseract exploded'));

    const result = await buildSpoilerData({ deadline: Date.now() + 60_000 });

    expect(result).toMatchObject({ ocrRan: 1, ocrPending: 0 });
    expect(setCachedOcrResultsMock).toHaveBeenCalledWith([
      { spoilerId: '1', imageUrl: imageUrl(1), effectRaw: '' },
    ]);
  });

  it('ignores cached text when refreshing OCR', async () => {
    mockUpstream([spoiler(1, 'One')]);

    const result = await buildSpoilerData({ deadline: Date.now() + 60_000, refreshOcr: true });

    expect(getCachedOcrResultsMock).not.toHaveBeenCalled();
    expect(recognizeMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ ocrHits: 0, ocrRan: 1 });
  });

  it('throws when the upstream API fails', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    })) as unknown as typeof fetch;

    await expect(buildSpoilerData({ deadline: Date.now() + 5_000 })).rejects.toThrow('503');
  });
});
