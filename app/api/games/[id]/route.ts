import { adminAuth, adminDb, adminStorage } from '@/lib/firebase/admin';
import { NextResponse } from 'next/server';
import { apiError } from '@/lib/httpResponses';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
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

/** Advertises deletion methods and bearer-token headers for CORS preflight. */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/** Verifies ownership before deleting the game and any associated uploaded assets. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Get the ID token from the Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return corsResponse('Unauthorized - No token provided', 401);
    }

    const idToken = authHeader.split('Bearer ')[1];

    // Verify the ID token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch {
      return corsResponse('Unauthorized - Invalid token', 401);
    }
    if (!decodedToken) {
      return corsResponse('Unauthorized - Invalid token', 401);
    }

    // Await the params to get the game ID
    const { id } = await params;
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

    if (gameData.username !== userData.username) {
      return corsResponse('Forbidden - You can only delete your own games', 403);
    }

    // If the game was uploaded via zip, clean up Firebase Storage files
    if (gameData.storageBasePath) {
      try {
        const bucket = adminStorage.bucket();
        const [files] = await bucket.getFiles({ prefix: gameData.storageBasePath + '/' });
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
