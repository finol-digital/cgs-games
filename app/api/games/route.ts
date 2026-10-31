import { adminAuth, adminDb, adminGetAllGames } from '@/lib/firebase/admin';
import { DEFAULT_CARD_BACK_PATH, resolveBannerImageUrl } from '@/lib/bannerFallback';
import { FieldValue } from 'firebase-admin/firestore';
import snakecase from 'lodash.snakecase';
import { NextResponse } from 'next/server';
import { apiError } from '@/lib/httpResponses';
import { fetchGameSpecification, UnsafeGameUrlError } from '@/lib/fetchGameSpecification';
import { ownsRegisteredUsername } from '@/lib/firebase/ownership';
import { countGamesFor, gameQuotaResponse, MAX_GAMES_PER_USER } from '@/lib/firebase/quota';
import { isHttpsUrl, MAX_URL_LENGTH, validateGameMetadata } from '@/lib/gameMetadata';

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
    if (autoUpdateUrl.length > MAX_URL_LENGTH) {
      return apiError(`autoUpdateUrl must be at most ${MAX_URL_LENGTH} characters`, 400);
    }

    const idToken = authHeader.split('Bearer ')[1];
    // Verify the Firebase ID token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken, true);
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
    if (!(await ownsRegisteredUsername(decodedToken.uid, username))) {
      return apiError('Username ownership could not be verified', 403);
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
    let specification: unknown;
    try {
      specification = await response.json();
    } catch {
      return apiError('The game specification is not valid JSON', 502);
    }
    if (!specification || typeof specification !== 'object' || Array.isArray(specification)) {
      return apiError('The game specification must be a JSON object', 400);
    }
    const cardGameSpecification = specification as {
      name: string;
      bannerImageUrl?: string;
      cardBackImageUrl?: string;
      copyright?: string;
    };
    // Stored values are rendered on shared pages; a malformed listing must not break them.
    const metadataError = validateGameMetadata(cardGameSpecification);
    if (metadataError) return apiError(`Invalid game specification: ${metadataError}`, 400);

    const slug = encodeURI(snakecase(cardGameSpecification.name));
    if (!slug) return apiError('Game name must produce a nonempty URL slug', 400);

    const existingGames = await adminDb
      .collection('games')
      .where('username', '==', username)
      .where('slug', '==', slug)
      .get();
    if (!existingGames.empty) {
      return apiError(
        `You already have a game named "${cardGameSpecification.name}". Delete it first or choose a different name.`,
        409,
      );
    }
    if ((await countGamesFor(username)) >= MAX_GAMES_PER_USER) return gameQuotaResponse();
    const game = {
      ownerUid: decodedToken.uid,
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

    if (game.bannerImageUrl !== DEFAULT_CARD_BACK_PATH && !isHttpsUrl(game.bannerImageUrl)) {
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
