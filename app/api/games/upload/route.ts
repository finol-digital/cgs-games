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
  console.log('Received game upload request', {
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
  });
  try {
    // Authenticate via Firebase ID token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Upload attempt missing Authorization header');
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 },
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken?.uid;
    console.log('Upload request authenticated', { uid });

    // Get the username from the user's document in Firestore
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      console.error('User document not found for uid', { uid });
      return NextResponse.json({ error: 'User document not found' }, { status: 404 });
    }

    const username = userDoc.data()?.username;
    if (!username) {
      console.error('Username missing on user document', { uid });
      return NextResponse.json({ error: 'Username not found in user document' }, { status: 400 });
    }

    // Read multipart form data and enforce size limit
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      console.error('No file field in multipart form');
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      console.error('Uploaded file exceeds size limit', { uid, username, size: file.size });
      return NextResponse.json({ error: 'File exceeds maximum size of 100MB' }, { status: 413 });
    }

    if (!file.name.endsWith('.cgs.zip')) {
      console.error('Uploaded file has wrong extension', { name: file.name });
      return NextResponse.json({ error: 'Only .cgs.zip files are accepted' }, { status: 400 });
    }

    console.log('Processing upload', { uid, username, filename: file.name, size: file.size });

    // Extract zip contents in memory
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    // Count entries for diagnostics
    let entryCount = 0;
    zip.forEach(() => (entryCount += 1));
    console.log('Zip loaded', { entryCount });

    // Locate cgs.json
    const located = locateCgsJson(zip);
    if (!located) {
      console.error('Failed to locate cgs.json in uploaded zip', { filename: file.name });
      return NextResponse.json({ error: 'Invalid .cgs.zip: missing cgs.json' }, { status: 400 });
    }

    const { cgsJsonFile, gameRoot } = located;

    // Parse and validate cgs.json
    let cgsJson: CgsJson;
    try {
      const cgsJsonContent = await cgsJsonFile.async('string');
      // Log a shortened preview to help debug formatting issues
      console.log('cgs.json preview', { preview: cgsJsonContent.slice(0, 500) });
      const parsed = JSON.parse(cgsJsonContent);
      const validationError = validateCgsJson(parsed);
      if (validationError) {
        console.error('cgs.json validation failed', { validationError });
        return NextResponse.json({ error: validationError }, { status: 400 });
      }
      cgsJson = parsed as CgsJson;
    } catch (err: unknown) {
      console.error('Failed to parse or validate cgs.json', { err });
      return NextResponse.json({ error: 'Invalid cgs.json: not valid JSON' }, { status: 400 });
    }

    // Generate slug from game name
    const slug = encodeURI(snakecase(cgsJson.name));
    console.log('Generated slug', { uid, username, slug, gameName: cgsJson.name });

    // Check for duplicate game
    const existingGames = await adminDb
      .collection('games')
      .where('username', '==', username)
      .where('slug', '==', slug)
      .get();

    if (!existingGames.empty) {
      console.error('Duplicate game detected for user', { uid, username, slug });
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
    try {
      cgsJson = rewriteCgsJsonUrls(
        cgsJson,
        storageBasePath,
        bucketName,
        username,
        slug,
        zip,
        gameRoot,
      );
    } catch (err: unknown) {
      console.error('rewriteCgsJsonUrls failed', { err });
      throw err;
    }

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

      const uploadPromise = zipEntry
        .async('nodebuffer')
        .then(async (buffer) => {
          const fileRef = bucket.file(storagePath);
          try {
            await fileRef.save(buffer, {
              metadata: { contentType },
              public: true,
            });
            console.log('Uploaded file to storage', { storagePath, contentType });
          } catch (err: unknown) {
            console.error('Failed to upload file to storage', { storagePath, err });
            throw err;
          }
        })
        .catch((err) => {
          // Ensure individual file errors are logged with context
          console.error('Upload promise rejected for entry', { relativePath, storagePath, err });
          throw err;
        });

      uploadPromises.push(uploadPromise);
    });

    // Upload rewritten cgs.json
    const cgsJsonBuffer = Buffer.from(JSON.stringify(cgsJson, null, 2), 'utf-8');
    const cgsJsonStoragePath = `${storageBasePath}/cgs.json`;
    uploadPromises.push(
      bucket
        .file(cgsJsonStoragePath)
        .save(cgsJsonBuffer, {
          metadata: { contentType: 'application/json' },
          public: true,
        })
        .then(() => console.log('Uploaded rewritten cgs.json', { cgsJsonStoragePath }))
        .catch((err) => {
          console.error('Failed to upload rewritten cgs.json', { cgsJsonStoragePath, err });
          throw err;
        }),
    );

    // Execute all uploads in parallel
    try {
      await Promise.all(uploadPromises);
    } catch (err: unknown) {
      console.error('One or more uploads failed', { err });
      throw err;
    }

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

    try {
      await adminDb.collection('games').add(game);
      console.log('Game document created', { username, slug, storageBasePath });
    } catch (err: unknown) {
      console.error('Failed to create game document in Firestore', { username, slug, err });
      throw err;
    }

    return NextResponse.json({
      success: true,
      slug,
    });
  } catch (error: unknown) {
    // Provide as much context as we have available without leaking tokens
    console.error('Error uploading game zip:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: 'Failed to process game upload' }, { status: 500 });
  }
}
