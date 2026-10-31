import {
  CgsJson,
  CONTENT_TYPE_MAP,
  declaredSize,
  fileExistsInZip,
  getFileExtension,
  getPublicUrl,
  isAllowedFile,
  locateCgsJson,
  MAX_ENTRY_BYTES,
  MAX_UNCOMPRESSED_BYTES,
  MAX_ZIP_ENTRIES,
  readZipEntry,
  rewriteCgsJsonUrls,
  validateCgsJson,
  ZipBudget,
  ZipLimitError,
} from '@/lib/cgsZipUtils';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase/admin';
import { resolveBannerImageUrl } from '@/lib/bannerFallback';
import { FieldValue } from 'firebase-admin/firestore';
import JSZip from 'jszip';
import snakecase from 'lodash.snakecase';
import { NextResponse } from 'next/server';
import { apiError } from '@/lib/httpResponses';
import { ownsRegisteredUsername } from '@/lib/firebase/ownership';
import {
  countGamesFor,
  gameQuotaResponse,
  MAX_GAMES_PER_USER,
  MAX_USER_STORAGE_BYTES,
  storedBytesFor,
} from '@/lib/firebase/quota';
import { isHttpsUrl } from '@/lib/gameMetadata';
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const UPLOAD_CONCURRENCY = 4;
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

/** Converts upload validation and processing failures to the shared JSON contract. */
function jsonError(error: string, status: number) {
  return apiError(error, status);
}

/** Recognizes the JSON upload variant before validating its individual fields. */
function isStagedUploadRequest(body: unknown): body is StagedUploadRequest {
  return !!body && typeof body === 'object' && 'stagedPath' in body;
}

/** Restricts staged archives to the authenticated user's storage directory. */
function isValidStagedPath(uid: string, stagedPath: string) {
  const parts = stagedPath.split('/');
  return (
    parts.length === 3 &&
    parts[0] === STAGED_UPLOAD_PREFIX &&
    parts[1] === uid &&
    /^[A-Za-z0-9_-]+\.cgs\.zip$/.test(parts[2])
  );
}

/** Verifies the ID token and resolves the creator profile required for publication. */
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
    decodedToken = await adminAuth.verifyIdToken(idToken, true);
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
  if (!(await ownsRegisteredUsername(uid, username))) {
    return jsonError('Username ownership could not be verified', 403);
  }

  return { uid, username };
}

/** Downloads and processes an owned staged archive, cleaning it up after the attempt. */
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

/** Validates a directly submitted archive's size and filename before processing. */
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

/** A decompression allowance limited by the archive size cap. */
function archiveBudget(bytes: number): ZipBudget {
  return {
    remaining: bytes,
    exceeded: () =>
      new ZipLimitError(
        `Archive exceeds ${MAX_UNCOMPRESSED_BYTES / (1024 * 1024)} MiB when decompressed`,
        'ARCHIVE_TOO_LARGE',
      ),
  };
}

/** A decompression allowance limited by the creator's remaining storage quota. */
function quotaBudget(bytes: number): ZipBudget {
  return {
    remaining: bytes,
    exceeded: () =>
      new ZipLimitError(
        'Publishing this game would exceed your storage quota',
        'STORAGE_QUOTA_EXCEEDED',
      ),
  };
}

/** Converts a decompression limit into a structured, actionable error. */
function zipLimitResponse(error: ZipLimitError) {
  const hint =
    error.code === 'STORAGE_QUOTA_EXCEEDED'
      ? `Delete some of your games first: each creator may store up to ${MAX_USER_STORAGE_BYTES / (1024 * 1024 * 1024)} GiB of published files.`
      : `Archives may expand to at most ${MAX_UNCOMPRESSED_BYTES / (1024 * 1024)} MiB, with no single file over ${MAX_ENTRY_BYTES / (1024 * 1024)} MiB.`;
  return apiError(error.message, 413, undefined, { code: error.code, hint });
}

/** Runs tasks with bounded concurrency, stops starting new ones after a failure, and awaits all. */
async function forEachLimited<T>(
  items: T[],
  limit: number,
  // eslint-disable-next-line no-unused-vars -- This parameter describes the callback's type.
  task: (item: T) => Promise<void>,
) {
  let next = 0;
  let failed = false;
  let failure: unknown;
  const worker = async () => {
    while (!failed && next < items.length) {
      const item = items[next++];
      try {
        await task(item);
      } catch (error) {
        if (!failed) failure = error;
        failed = true;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  if (failed) throw failure;
}

/** Validates the game archive, publishes supported assets, and creates its catalog entry. */
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
  if (entryCount > MAX_ZIP_ENTRIES) {
    console.error('Uploaded zip has too many entries', { uid, username, entryCount });
    return apiError(`Archive contains more than ${MAX_ZIP_ENTRIES} entries`, 413, undefined, {
      code: 'TOO_MANY_FILES',
      hint: `Archives may contain at most ${MAX_ZIP_ENTRIES} files and folders.`,
    });
  }

  const located = locateCgsJson(zip);
  if (!located) {
    console.error('Failed to locate cgs.json in uploaded zip', { filename });
    return jsonError('Invalid .cgs.zip: missing cgs.json', 400);
  }

  const { cgsJsonFile, gameRoot } = located;

  let cgsJson: CgsJson;
  try {
    const cgsJsonContent = await readZipEntry(cgsJsonFile, archiveBudget(MAX_UNCOMPRESSED_BYTES));
    const parsed = JSON.parse(cgsJsonContent.toString('utf-8'));
    const validationError = validateCgsJson(parsed);
    if (validationError) {
      console.error('cgs.json validation failed', { validationError });
      return jsonError(validationError, 400);
    }
    cgsJson = parsed as CgsJson;
  } catch (err: unknown) {
    if (err instanceof ZipLimitError) return zipLimitResponse(err);
    console.error('Failed to parse or validate cgs.json', { err });
    return jsonError('Invalid cgs.json: not valid JSON', 400);
  }

  const slug = encodeURI(snakecase(cgsJson.name));
  if (!slug) return jsonError('Game name must produce a nonempty URL slug', 400);
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

  if ((await countGamesFor(username)) >= MAX_GAMES_PER_USER) {
    console.error('Game quota exceeded', { uid, username });
    return gameQuotaResponse();
  }

  // The archive may expand to its own limit or the creator's remaining storage, whichever is less.
  const storageRemaining = MAX_USER_STORAGE_BYTES - (await storedBytesFor(uid));
  const budget =
    storageRemaining < MAX_UNCOMPRESSED_BYTES
      ? quotaBudget(storageRemaining)
      : archiveBudget(MAX_UNCOMPRESSED_BYTES);

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

  const entries: { zipEntry: JSZip.JSZipObject; gameRelativePath: string }[] = [];
  zip.forEach((relativePath, zipEntry) => {
    if (zipEntry.dir) return;

    let gameRelativePath = relativePath;
    if (gameRoot && relativePath.startsWith(gameRoot + '/')) {
      gameRelativePath = relativePath.substring(gameRoot.length + 1);
    }

    if (gameRelativePath === 'cgs.json') return;
    if (!isAllowedFile(gameRelativePath)) return;
    entries.push({ zipEntry, gameRelativePath });
  });

  const cgsJsonBuffer = Buffer.from(JSON.stringify(cgsJson, null, 2), 'utf-8');
  budget.remaining -= cgsJsonBuffer.length;
  // Reject honestly described oversized archives before writing anything. Declared sizes are
  // untrusted, so readZipEntry still enforces the same budget on the bytes actually produced.
  const declaredTotal = entries.reduce((total, { zipEntry }) => total + declaredSize(zipEntry), 0);
  if (budget.remaining < 0 || declaredTotal > budget.remaining) {
    console.error('Upload exceeds decompression budget', { uid, username, declaredTotal });
    return zipLimitResponse(budget.exceeded());
  }

  const savedPaths: string[] = [];
  const save = async (storagePath: string, buffer: Buffer, contentType: string) => {
    await bucket.file(storagePath).save(buffer, { metadata: { contentType }, public: true });
    savedPaths.push(storagePath);
    console.log('Uploaded file to storage', { storagePath, contentType });
  };

  try {
    // Decompress a few entries at a time so memory stays bounded regardless of archive layout.
    await forEachLimited(entries, UPLOAD_CONCURRENCY, async ({ zipEntry, gameRelativePath }) => {
      const storagePath = `${storageBasePath}/${gameRelativePath}`;
      const ext = getFileExtension(gameRelativePath);
      const contentType = CONTENT_TYPE_MAP[ext] || 'application/octet-stream';
      await save(storagePath, await readZipEntry(zipEntry, budget), contentType);
    });

    const cgsJsonStoragePath = `${storageBasePath}/cgs.json`;
    await save(cgsJsonStoragePath, cgsJsonBuffer, 'application/json');

    const autoUpdateUrl = getPublicUrl(bucketName, cgsJsonStoragePath);
    const bannerExt = cgsJson.bannerImageFileType || 'png';
    const bannerFile = `Banner.${bannerExt}`;
    const hasBanner = fileExistsInZip(zip, bannerFile, gameRoot);
    // Fall back to the game card back, then the CGS default card back.
    const bannerImageUrl = hasBanner
      ? getPublicUrl(bucketName, `${storageBasePath}/${bannerFile}`)
      : resolveBannerImageUrl({
          cardBackImageUrl: isHttpsUrl(cgsJson.cardBackImageUrl)
            ? cgsJson.cardBackImageUrl
            : undefined,
        });

    const game = {
      ownerUid: uid,
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
    console.log('Game document created', { username, slug, storageBasePath });
  } catch (err: unknown) {
    // Never leave published files behind for a listing that was not created.
    await Promise.allSettled(savedPaths.map(async (path) => bucket.file(path).delete()));
    if (err instanceof ZipLimitError) return zipLimitResponse(err);
    console.error('Failed to publish uploaded game', { username, slug, err });
    throw err;
  }

  return NextResponse.json({
    success: true,
    slug,
  });
}

/** Authenticates and dispatches either upload format, including asynchronous failures. */
export async function POST(request: Request) {
  console.log('Received game upload request', {
    method: request.method,
    url: request.url,
    contentType: request.headers.get('content-type'),
  });
  try {
    const authenticatedUser = await authenticateUploadRequest(request);
    if (authenticatedUser instanceof NextResponse) return authenticatedUser;

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonError('Request body must be valid JSON', 400);
      }
      if (!isStagedUploadRequest(body)) {
        return jsonError('Missing staged upload path', 400);
      }

      if (typeof body.stagedPath !== 'string' || typeof body.originalFilename !== 'string') {
        return jsonError('Invalid staged upload request', 400);
      }

      return await processStagedUpload({
        ...authenticatedUser,
        stagedPath: body.stagedPath,
        originalFilename: body.originalFilename,
      });
    }

    return await processMultipartUpload(request, authenticatedUser);
  } catch (error: unknown) {
    console.error('Error uploading game zip:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return jsonError('Failed to process game upload', 500);
  }
}
