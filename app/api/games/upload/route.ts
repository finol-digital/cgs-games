import {
  CgsJson,
  CONTENT_TYPE_MAP,
  fileExistsInZip,
  getFileExtension,
  getPublicUrl,
  isAllowedFile,
  locateCgsJson,
  rewriteCgsJsonUrls,
  validateCgsJson,
} from '@/lib/cgsZipUtils';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import JSZip from 'jszip';
import snakecase from 'lodash.snakecase';
import { NextResponse } from 'next/server';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export async function POST(request: Request) {
  try {
    // Authenticate via Firebase ID token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 },
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
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

    // Read multipart form data and enforce size limit
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File exceeds maximum size of 100MB' }, { status: 413 });
    }

    if (!file.name.endsWith('.cgs.zip')) {
      return NextResponse.json({ error: 'Only .cgs.zip files are accepted' }, { status: 400 });
    }

    // Extract zip contents in memory
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Locate cgs.json
    const located = locateCgsJson(zip);
    if (!located) {
      return NextResponse.json({ error: 'Invalid .cgs.zip: missing cgs.json' }, { status: 400 });
    }

    const { cgsJsonFile, gameRoot } = located;

    // Parse and validate cgs.json
    let cgsJson: CgsJson;
    try {
      const cgsJsonContent = await cgsJsonFile.async('string');
      const parsed = JSON.parse(cgsJsonContent);
      const validationError = validateCgsJson(parsed);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }
      cgsJson = parsed as CgsJson;
    } catch {
      return NextResponse.json({ error: 'Invalid cgs.json: not valid JSON' }, { status: 400 });
    }

    // Generate slug from game name
    const slug = encodeURI(snakecase(cgsJson.name));

    // Check for duplicate game
    const existingGames = await adminDb
      .collection('games')
      .where('username', '==', username)
      .where('slug', '==', slug)
      .get();

    if (!existingGames.empty) {
      return NextResponse.json(
        {
          error: `You already have a game named "${cgsJson.name}". Delete it first or choose a different name.`,
        },
        { status: 409 },
      );
    }

    // Upload all valid extracted files to Firebase Storage
    const storageBasePath = `games/${decodedToken.uid}/${slug}`;
    const bucket = adminStorage.bucket();
    const bucketName = bucket.name;

    // Rewrite URLs in cgs.json before uploading
    cgsJson = rewriteCgsJsonUrls(
      cgsJson,
      storageBasePath,
      bucketName,
      username,
      slug,
      zip,
      gameRoot,
    );

    // Collect all files to upload
    const uploadPromises: Promise<void>[] = [];

    zip.forEach((relativePath, zipEntry) => {
      // Skip directories
      if (zipEntry.dir) return;

      // Get path relative to game root
      let gameRelativePath = relativePath;
      if (gameRoot && relativePath.startsWith(gameRoot + '/')) {
        gameRelativePath = relativePath.substring(gameRoot.length + 1);
      }

      // Skip cgs.json - we'll upload the rewritten version
      if (gameRelativePath === 'cgs.json') return;

      // Filter to known safe extensions
      if (!isAllowedFile(gameRelativePath)) return;

      const storagePath = `${storageBasePath}/${gameRelativePath}`;
      const ext = getFileExtension(gameRelativePath);
      const contentType = CONTENT_TYPE_MAP[ext] || 'application/octet-stream';

      const uploadPromise = zipEntry.async('nodebuffer').then(async (buffer) => {
        const fileRef = bucket.file(storagePath);
        await fileRef.save(buffer, {
          metadata: { contentType },
          public: true,
        });
      });

      uploadPromises.push(uploadPromise);
    });

    // Upload rewritten cgs.json
    const cgsJsonBuffer = Buffer.from(JSON.stringify(cgsJson, null, 2), 'utf-8');
    const cgsJsonStoragePath = `${storageBasePath}/cgs.json`;
    uploadPromises.push(
      bucket.file(cgsJsonStoragePath).save(cgsJsonBuffer, {
        metadata: { contentType: 'application/json' },
        public: true,
      }),
    );

    // Execute all uploads in parallel
    await Promise.all(uploadPromises);

    // Create Firestore game document
    const autoUpdateUrl = getPublicUrl(bucketName, cgsJsonStoragePath);
    const bannerExt = cgsJson.bannerImageFileType || 'png';
    const bannerFile = `Banner.${bannerExt}`;
    const hasBanner = fileExistsInZip(zip, bannerFile, gameRoot);
    const bannerImageUrl = hasBanner
      ? getPublicUrl(bucketName, `${storageBasePath}/${bannerFile}`)
      : '';

    const game = {
      username,
      slug,
      name: cgsJson.name,
      bannerImageUrl,
      autoUpdateUrl,
      copyright: cgsJson.copyright || username,
      uploadedAt: FieldValue.serverTimestamp(),
      storageBasePath,
    };

    await adminDb.collection('games').add(game);

    return NextResponse.json({
      success: true,
      slug,
    });
  } catch (error: unknown) {
    console.error('Error uploading game zip:', error);
    const message = error instanceof Error ? error.message : 'Failed to process game upload';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
