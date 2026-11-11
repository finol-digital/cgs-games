import { adminAuth, adminDb, adminStorage } from '@/lib/firebase/admin';
import { NextResponse } from 'next/server';
import { DocumentReference } from 'firebase-admin/firestore';
import { apiError } from '@/lib/httpResponses';
import {
  isOwnershipSegment,
  ownedStoragePrefix,
  ownsGame,
  ownsRegisteredUsername,
} from '@/lib/firebase/ownership';
import { isGameVisibility } from '@/lib/game';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/** Retains text successes and adds the shared JSON envelope to deletion errors. */
function corsResponse(message: string, status: number) {
  if (status >= 400) return apiError(message, status, corsHeaders);
  return new NextResponse(message, {
    status,
    headers: corsHeaders,
  });
}

/** Advertises game management methods and bearer-token headers for CORS preflight. */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

interface OwnedGame {
  uid: string;
  gameRef: DocumentReference;
  gameData: Record<string, unknown>;
}

/** Resolves the requested game, or the error response when the caller cannot manage it. */
async function authorizeOwner(
  request: Request,
  params: Promise<{ id: string }>,
  action: string,
): Promise<OwnedGame | NextResponse> {
  // Get the ID token from the Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return corsResponse('Unauthorized - No token provided', 401);
  }

  const idToken = authHeader.split('Bearer ')[1];

  // Verify the ID token
  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken, true);
  } catch {
    return corsResponse('Unauthorized - Invalid token', 401);
  }
  if (!decodedToken) {
    return corsResponse('Unauthorized - Invalid token', 401);
  }

  // Await the params to get the game ID
  const { id } = await params;
  if (!isOwnershipSegment(id)) return corsResponse('Invalid game ID', 400);
  const gameRef = adminDb.collection('games').doc(id);
  const gameDoc = await gameRef.get();

  if (!gameDoc.exists) {
    return corsResponse('Game not found', 404);
  }

  // Check if the authenticated user owns the game
  const gameData = gameDoc.data();
  if (!gameData?.username) {
    return corsResponse('Game data is invalid', 400);
  }

  // Get the user's username from the users collection
  const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
  if (!userDoc.exists) {
    return corsResponse('User not found', 404);
  }

  const userData = userDoc.data();
  if (!userData?.username) {
    return corsResponse('User data is invalid', 400);
  }

  if (
    !(await ownsRegisteredUsername(decodedToken.uid, userData.username)) ||
    !ownsGame(decodedToken.uid, userData.username, gameData)
  ) {
    return corsResponse(`Forbidden - You can only ${action} your own games`, 403);
  }

  return { uid: decodedToken.uid, gameRef, gameData };
}

/** Verifies ownership before changing whether the game is listed publicly. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return corsResponse('Request body must be valid JSON', 400);
    }
    const visibility = body?.visibility;
    if (!isGameVisibility(visibility)) {
      return corsResponse('visibility must be "public" or "private"', 400);
    }

    const owned = await authorizeOwner(request, params, 'update');
    if (owned instanceof NextResponse) return owned;

    await owned.gameRef.update({ visibility });
    return NextResponse.json({ success: true, visibility }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error updating game:', error);
    return corsResponse('Error updating game', 500);
  }
}

/** Verifies ownership before deleting the game and any associated uploaded assets. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const owned = await authorizeOwner(request, params, 'delete');
    if (owned instanceof NextResponse) return owned;
    const { uid, gameRef, gameData } = owned;

    // If the game was uploaded via zip, clean up Firebase Storage files
    if (gameData.storageBasePath) {
      const prefix = ownedStoragePrefix(uid, gameData);
      if (!prefix) return corsResponse('Game storage ownership could not be verified', 403);
      try {
        const bucket = adminStorage.bucket();
        const [files] = await bucket.getFiles({ prefix });
        if (files.length > 0) {
          await Promise.all(files.map((file) => file.delete()));
        }
      } catch (storageError) {
        console.error('Error deleting Storage files:', storageError);
        // Continue with Firestore deletion even if Storage cleanup fails
      }
    }

    await gameRef.delete();
    return corsResponse('Game deleted successfully', 200);
  } catch (error) {
    console.error('Error deleting game:', error);
    return corsResponse('Error deleting game', 500);
  }
}
