import { stat, readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadToken, verifySession } from './auth.mjs';
import { requestJson } from './http.mjs';

const maximumSize = 100 * 1024 * 1024;

/** Sends an archive using the Firebase SDK's multipart/related storage protocol and security rules. */
export async function stageArchive(bucket, stagedPath, bytes, token) {
  const url = new URL(
    `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o`,
  );
  url.searchParams.set('name', stagedPath);
  const boundary = randomUUID();
  const metadata = JSON.stringify({ name: stagedPath, contentType: 'application/zip' });
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/zip\r\n\r\n`,
    bytes,
    `\r\n--${boundary}--`,
  ]);
  const response = await fetch(url, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(300000),
    body,
    headers: {
      Authorization: `Firebase ${token}`,
      'X-Goog-Upload-Protocol': 'multipart',
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
  });
  if (!response.ok)
    throw new Error(
      `Storage upload failed (HTTP ${response.status}). Sign in again if the token expired.`,
    );
}

/** Deletes only this attempt's unique staged object, including after failed or ambiguous requests. */
async function cleanupStage(bucket, stagedPath, token) {
  try {
    await fetch(
      `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(stagedPath)}`,
      {
        method: 'DELETE',
        redirect: 'error',
        signal: AbortSignal.timeout(30000),
        headers: { Authorization: `Firebase ${token}` },
      },
    );
  } catch {
    /* Server-side processing also cleans staged objects; do not hide the original result. */
  }
}

/** Validates input before authentication, then publishes once using the existing API contract. */
export async function uploadCommand(origin, { url, file, dryRun }) {
  let size;
  if (url) {
    let source;
    try {
      source = new URL(url);
    } catch {
      throw new Error('--url must be a public HTTPS game specification URL.');
    }
    if (source.protocol !== 'https:' || source.username || source.password || source.hash)
      throw new Error('--url must be a public HTTPS game specification URL without credentials.');
  } else {
    if (!file.endsWith('.cgs.zip')) throw new Error('Only .cgs.zip files are accepted.');
    const info = await stat(file);
    if (!info.isFile() || info.size <= 0 || info.size > maximumSize)
      throw new Error('Archive must be a nonempty file no larger than 100 MiB.');
    size = info.size;
  }
  if (dryRun)
    return {
      dryRun: true,
      origin: origin.origin,
      ...(url ? { autoUpdateUrl: url } : { filename: basename(file), bytes: size }),
    };
  const token = await loadToken(origin);
  const session = await verifySession(origin, token);
  if (!session.username)
    throw new Error(`Choose a creator username at ${new URL('/upload', origin)} before uploading.`);
  const options = {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    timeout: 300000,
  };
  if (url)
    return requestJson(new URL('/api/games', origin), {
      ...options,
      body: JSON.stringify({ autoUpdateUrl: url }),
    });
  const bytes = await readFile(file);
  if (bytes.length !== size || bytes.length > maximumSize)
    throw new Error('Archive changed while reading; retry with a stable file.');
  const stagedPath = `staged-uploads/${session.uid}/${randomUUID()}.cgs.zip`;
  try {
    await stageArchive(session.storageBucket, stagedPath, bytes, token);
    return await requestJson(new URL('/api/games/upload', origin), {
      ...options,
      body: JSON.stringify({ stagedPath, originalFilename: basename(file) }),
    });
  } finally {
    await cleanupStage(session.storageBucket, stagedPath, token);
  }
}
