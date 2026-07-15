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
const STAGED_UPLOAD_PREFIX = 'staged-uploads';

interface AuthenticatedUser {
  uid: string;
  username: string;
}

interface StagedUploadRequest {
  stagedPath?: unknown;
  originalFilename?: unknown;
}

interface ProcessZipUploadInput extends AuthenticatedUser {
  filename: string;
  zipBuffer: Buffer;
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function isStagedUploadRequest(body: unknown): body is StagedUploadRequest {
  return !!body && typeof body === 'object' && 'stagedPath' in body;
}

function isValidStagedPath(uid: string, stagedPath: string) {
  const parts = stagedPath.split('/');
  return (
    parts.length === 3 &&
    parts[0] === STAGED_UPLOAD_PREFIX &&
    parts[1] === uid &&
    /^[A-Za-z0-9_-]+\.cgs\.zip$/.test(parts[2])
  );
}

async function authenticateUploadRequest(
  request: Request,
): Promise<AuthenticatedUser | NextResponse> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('Upload attempt missing Authorization header');
    return jsonError('Missing or invalid Authorization header', 401);
  }

  const idToken = authHeader.split('Bearer ')[1];
  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch (err) {
    console.error('Token verification failed', { error: err instanceof Error ? err.message : err });
    return jsonError('Invalid or expired token', 401);
  }
  const uid = decodedToken?.uid;
  console.log('Upload request authenticated', { uid });

  const userDoc = await adminDb.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    console.error('User document not found for uid', { uid });
    return jsonError('User document not found', 404);
  }

  const username = userDoc.data()?.username;
  if (!username) {
    console.error('Username missing on user document', { uid });
    return jsonError('Username not found in user document', 400);
  }

  return { uid, username };
}

async function processStagedUpload({
  uid,
  username,
  stagedPath,
  originalFilename,
}: AuthenticatedUser & { stagedPath: string; originalFilename: string }) {
  if (!isValidStagedPath(uid, stagedPath)) {
    console.error('Invalid staged upload path', { uid, stagedPath });
    return jsonError('Invalid staged upload path', 400);
  }

  if (!originalFilename.endsWith('.cgs.zip')) {
    console.error('Staged upload has wrong original extension', { originalFilename });
    return jsonError('Only .cgs.zip files are accepted', 400);
  }

  const bucket = adminStorage.bucket();
  const stagedFile = bucket.file(stagedPath);

  try {
    const [metadata] = await stagedFile.getMetadata();
    const stagedSize = Number(metadata.size || 0);
    if (stagedSize > MAX_FILE_SIZE) {
      console.error('Staged upload exceeds size limit', { uid, username, stagedPath, stagedSize });
      return jsonError('File exceeds maximum size of 100MB', 413);
    }

    const [zipBuffer] = await stagedFile.download();
    if (zipBuffer.length > MAX_FILE_SIZE) {
      console.error('Downloaded staged upload exceeds size limit', {
        uid,
        username,
        stagedPath,
        size: zipBuffer.length,
      });
      return jsonError('File exceeds maximum size of 100MB', 413);
    }

    return await processZipUpload({ uid, username, filename: originalFilename, zipBuffer });
  } finally {
    try {
      await stagedFile.delete();
      console.log('Deleted staged upload', { stagedPath });
    } catch (deleteError: unknown) {
      console.error('Failed to delete staged upload', { stagedPath, deleteError });
    }
  }
}

async function processMultipartUpload(request: Request, { uid, username }: AuthenticatedUser) {
  const formData = await request.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    console.error('No file field in multipart form');
    return jsonError('No file uploaded', 400);
  }

  if (file.size > MAX_FILE_SIZE) {
    console.error('Uploaded file exceeds size limit', { uid, username, size: file.size });
    return jsonError('File exceeds maximum size of 100MB', 413);
  }

  if (!file.name.endsWith('.cgs.zip')) {
    console.error('Uploaded file has wrong extension', { name: file.name });
    return jsonError('Only .cgs.zip files are accepted', 400);
  }

  const arrayBuffer = await file.arrayBuffer();
  return processZipUpload({
    uid,
    username,
    filename: file.name,
    zipBuffer: Buffer.from(arrayBuffer),
  });
}

async function processZipUpload({ uid, username, filename, zipBuffer }: ProcessZipUploadInput) {
  console.log('Processing upload', { uid, username, filename, size: zipBuffer.length });

  if (zipBuffer.length > MAX_FILE_SIZE) {
    console.error('Uploaded file exceeds size limit', { uid, username, size: zipBuffer.length });
    return jsonError('File exceeds maximum size of 100MB', 413);
  }

  if (!filename.endsWith('.cgs.zip')) {
    console.error('Uploaded file has wrong extension', { filename });
    return jsonError('Only .cgs.zip files are accepted', 400);
  }

  const zip = await JSZip.loadAsync(zipBuffer);
  let entryCount = 0;
  zip.forEach(() => (entryCount += 1));
  console.log('Zip loaded', { entryCount });

  const located = locateCgsJson(zip);
  if (!located) {
    console.error('Failed to locate cgs.json in uploaded zip', { filename });
    return jsonError('Invalid .cgs.zip: missing cgs.json', 400);
  }

  const { cgsJsonFile, gameRoot } = located;

  let cgsJson: CgsJson;
  try {
    const cgsJsonContent = await cgsJsonFile.async('string');
    console.log('cgs.json preview', { preview: cgsJsonContent.slice(0, 500) });
    const parsed = JSON.parse(cgsJsonContent);
    const validationError = validateCgsJson(parsed);
    if (validationError) {
      console.error('cgs.json validation failed', { validationError });
      return jsonError(validationError, 400);
    }
    cgsJson = parsed as CgsJson;
  } catch (err: unknown) {
    console.error('Failed to parse or validate cgs.json', { err });
    return jsonError('Invalid cgs.json: not valid JSON', 400);
  }

  const slug = encodeURI(snakecase(cgsJson.name));
  console.log('Generated slug', { uid, username, slug, gameName: cgsJson.name });

  const existingGames = await adminDb
    .collection('games')
    .where('username', '==', username)
    .where('slug', '==', slug)
    .get();

  if (!existingGames.empty) {
    console.error('Duplicate game detected for user', { uid, username, slug });
    return jsonError(
      `You already have a game named "${cgsJson.name}". Delete it first or choose a different name.`,
      409,
    );
  }

  const storageBasePath = `games/${uid}/${slug}`;
  const bucket = adminStorage.bucket();
  const bucketName = bucket.name;

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

  const uploadPromises: Promise<void>[] = [];

  zip.forEach((relativePath, zipEntry) => {
    if (zipEntry.dir) return;

    let gameRelativePath = relativePath;
    if (gameRoot && relativePath.startsWith(gameRoot + '/')) {
      gameRelativePath = relativePath.substring(gameRoot.length + 1);
    }

    if (gameRelativePath === 'cgs.json') return;
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
        console.error('Upload promise rejected for entry', { relativePath, storagePath, err });
        throw err;
      });

    uploadPromises.push(uploadPromise);
  });

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

  try {
    await Promise.all(uploadPromises);
  } catch (err: unknown) {
    console.error('One or more uploads failed', { err });
    throw err;
  }

  const autoUpdateUrl = getPublicUrl(bucketName, cgsJsonStoragePath);
  const bannerExt = cgsJson.bannerImageFileType || 'png';
  const bannerFile = `Banner.${bannerExt}`;
  const hasBanner = fileExistsInZip(zip, bannerFile, gameRoot);
  // Fall back to the card back image when the game has no banner image
  const bannerImageUrl = hasBanner
    ? getPublicUrl(bucketName, `${storageBasePath}/${bannerFile}`)
    : cgsJson.cardBackImageUrl || '';

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
}

export async function POST(request: Request) {
  console.log('Received game upload request', {
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(
      Array.from(request.headers.entries()).filter(
        ([key]) => key.toLowerCase() !== 'authorization',
      ),
    ),
  });
  try {
    const authenticatedUser = await authenticateUploadRequest(request);
    if (authenticatedUser instanceof NextResponse) return authenticatedUser;

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await request.json();
      if (!isStagedUploadRequest(body)) {
        return jsonError('Missing staged upload path', 400);
      }

      if (typeof body.stagedPath !== 'string' || typeof body.originalFilename !== 'string') {
        return jsonError('Invalid staged upload request', 400);
      }

      return processStagedUpload({
        ...authenticatedUser,
        stagedPath: body.stagedPath,
        originalFilename: body.originalFilename,
      });
    }

    return processMultipartUpload(request, authenticatedUser);
  } catch (error: unknown) {
    console.error('Error uploading game zip:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: 'Failed to process game upload' }, { status: 500 });
  }
}
