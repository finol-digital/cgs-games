import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { getAllGames } from '@/lib/firebase/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import snakecase from 'lodash.snakecase';
import { NextResponse } from 'next/server';

export async function GET() {
  const allGames = await getAllGames();
  return new NextResponse(JSON.stringify(allGames), {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(request: Request) {
  try {
    const { autoUpdateUrl } = await request.json();
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 },
      );
    }

    if (!autoUpdateUrl) {
      return NextResponse.json({ error: 'Missing autoUpdateUrl' }, { status: 400 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    // Verify the Firebase ID token
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    // Get the username from the user's document in Firestore
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User document not found' }, { status: 404 });
    }

    const username = userDoc.data()?.username;
    if (!username) {
      return NextResponse.json({ error: 'Username not found in user document' }, { status: 400 });
    }

    const response = await fetch(autoUpdateUrl);
    const cardGameSpecification: {
      name: string;
      bannerImageUrl: string;
      copyright: string;
    } = await response.json();

    const slug = encodeURI(snakecase(cardGameSpecification.name));
    const game = {
      username: username,
      slug: slug,
      name: cardGameSpecification.name,
      bannerImageUrl: cardGameSpecification.bannerImageUrl,
      autoUpdateUrl: autoUpdateUrl,
      copyright: cardGameSpecification.copyright ? cardGameSpecification.copyright : username,
      uploadedAt: FieldValue.serverTimestamp(),
    };

    const isValidUrl = new URL(game.bannerImageUrl).protocol === 'https:';
    if (!isValidUrl) {
      return NextResponse.json({ error: 'Invalid bannerImageUrl!' }, { status: 400 });
    }

    await adminDb.collection('games').add(game);

    return NextResponse.json({
      success: true,
      slug: slug,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
