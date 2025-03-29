import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function corsResponse(message: string, status: number) {
  return new NextResponse(message, {
    status,
    headers: corsHeaders,
  });
}

// Handle OPTIONS request for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Get the ID token from the Authorization header
    const headersList = await headers();
    const authHeader = headersList.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return corsResponse('Unauthorized - No token provided', 401);
    }

    const idToken = authHeader.split('Bearer ')[1];

    // Verify the ID token
    const decodedToken = await adminAuth.verifyIdToken(idToken);
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

    await gameRef.delete();
    return corsResponse('Game deleted successfully', 200);
  } catch (error) {
    console.error('Error deleting game:', error);
    return corsResponse('Error deleting game', 500);
  }
}
