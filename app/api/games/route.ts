import { adminAuth, adminDb, adminGetAllGames } from '@/lib/firebase/admin';
import { DEFAULT_CARD_BACK_PATH, resolveBannerImageUrl } from '@/lib/bannerFallback';
import { FieldValue } from 'firebase-admin/firestore';
import snakecase from 'lodash.snakecase';
import { NextResponse } from 'next/server';
import { apiError } from '@/lib/httpResponses';
import { fetchGameSpecification, UnsafeGameUrlError } from '@/lib/fetchGameSpecification';

/** Lists the newest public games and returns a structured error if storage is unavailable. */
export async function GET() {
  try {
    return NextResponse.json(await adminGetAllGames(), {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error) {
    console.error('Failed to list games:', error);
    return apiError('Failed to list games', 500, { 'Access-Control-Allow-Origin': '*' });
  }
}

/** Authenticates a creator and publishes metadata from a public HTTPS game specification. */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return apiError('Missing or invalid Authorization header', 401);
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return apiError('Request body must be valid JSON', 400);
    }
    const autoUpdateUrl = body?.autoUpdateUrl;
    if (typeof autoUpdateUrl !== 'string' || !autoUpdateUrl) {
      return apiError('Missing autoUpdateUrl', 400);
    }

    const idToken = authHeader.split('Bearer ')[1];
    // Verify the Firebase ID token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch {
      return apiError('Invalid or expired token', 401);
    }

    // Get the username from the user's document in Firestore
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists) {
      return apiError('User document not found', 404);
    }

    const username = userDoc.data()?.username;
    if (!username) {
      return apiError('Username not found in user document', 400);
    }

    let response;
    try {
      response = await fetchGameSpecification(autoUpdateUrl);
    } catch (error) {
      if (error instanceof UnsafeGameUrlError) return apiError(error.message, 400);
      console.error('Failed to fetch game specification:', error);
      return apiError('Failed to fetch the game specification', 502);
    }
    if (!response.ok) return apiError('Failed to fetch the game specification', 502);
    const cardGameSpecification: {
      name: string;
      bannerImageUrl?: string;
      cardBackImageUrl?: string;
      copyright: string;
    } = await response.json();

    const slug = encodeURI(snakecase(cardGameSpecification.name));
    const game = {
      username: username,
      slug: slug,
      name: cardGameSpecification.name,
      // Fall back to the game card back, then the CGS default card back.
      bannerImageUrl: resolveBannerImageUrl({
        bannerImageUrl: cardGameSpecification.bannerImageUrl,
        cardBackImageUrl: cardGameSpecification.cardBackImageUrl,
      }),
      autoUpdateUrl: autoUpdateUrl,
      copyright: cardGameSpecification.copyright ? cardGameSpecification.copyright : username,
      uploadedAt: FieldValue.serverTimestamp(),
    };

    let isValidUrl: boolean;
    try {
      isValidUrl =
        game.bannerImageUrl === DEFAULT_CARD_BACK_PATH ||
        new URL(game.bannerImageUrl).protocol === 'https:';
    } catch {
      isValidUrl = false;
    }
    if (!isValidUrl) {
      return apiError('Invalid bannerImageUrl!', 400);
    }

    await adminDb.collection('games').add(game);

    return NextResponse.json({
      success: true,
      slug: slug,
    });
  } catch (error: unknown) {
    console.error('Failed to publish game:', error);
    return apiError('Failed to publish game', 500);
  }
}
