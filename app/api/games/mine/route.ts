import { adminAuth, adminDb, adminGetGamesFor } from '@/lib/firebase/admin';
import { NextResponse } from 'next/server';
import { apiError } from '@/lib/httpResponses';
import { ownsRegisteredUsername } from '@/lib/firebase/ownership';

const headers = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };

/** Lists every game the authenticated creator owns, including private games hidden elsewhere. */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return apiError('Missing or invalid Authorization header', 401, headers);
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1], true);
    } catch {
      return apiError('Invalid or expired token', 401, headers);
    }

    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const username = userDoc.data()?.username;
    if (!username) return apiError('Username not found in user document', 404, headers);
    if (!(await ownsRegisteredUsername(decodedToken.uid, username))) {
      return apiError('Username ownership could not be verified', 403, headers);
    }

    return NextResponse.json(await adminGetGamesFor(username, { includePrivate: true }), {
      headers,
    });
  } catch (error) {
    console.error('Failed to list owned games:', error);
    return apiError('Failed to list your games', 500, headers);
  }
}
