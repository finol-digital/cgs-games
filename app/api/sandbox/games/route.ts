import { NextResponse } from 'next/server';

/** A deterministic read-only fixture: never initializes Firebase or contacts an upstream. */
export async function GET() {
  return NextResponse.json(
    [
      {
        id: 'sandbox-example',
        username: 'sandbox',
        slug: 'example_card_game',
        name: 'Example Card Game (sandbox fixture)',
        bannerImageUrl: '/CardBack.png',
        autoUpdateUrl: 'https://example.invalid/cgs.json',
        copyright: 'Sandbox example only',
        uploadedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    { headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } },
  );
}
