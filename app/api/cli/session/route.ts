import { NextResponse } from 'next/server';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase/admin';
import { apiError } from '@/lib/httpResponses';

/** Verifies a short-lived CLI credential without issuing tokens or changing account permissions. */
export async function POST(request: Request) {
  const match = /^Bearer (\S+)$/.exec(request.headers.get('authorization') || '');
  if (!match) return apiError('Missing or invalid Authorization header', 401);
  let token;
  try {
    token = await adminAuth.verifyIdToken(match[1], true);
  } catch {
    return apiError('Invalid, revoked, or expired token', 401);
  }
  try {
    const profile = await adminDb.collection('users').doc(token.uid).get();
    return NextResponse.json(
      {
        uid: token.uid,
        username: profile.data()?.username || null,
        expiresAt: new Date(token.exp * 1000).toISOString(),
        storageBucket: adminStorage.bucket().name,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return apiError('Unable to check CLI session', 503);
  }
}
