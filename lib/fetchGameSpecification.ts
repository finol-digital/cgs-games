import { lookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { get } from 'node:https';
import { isIP } from 'node:net';
import { checkServerIdentity } from 'node:tls';
import ipaddr from 'ipaddr.js';

const MAX_BYTES = 16 * 1024 * 1024;
const REDIRECTS = new Set([301, 302, 303, 307, 308]);

/** Bounds DNS resolution by the same deadline as the subsequent HTTPS connection. */
async function lookupBeforeDeadline(
  hostname: string,
  signal: AbortSignal,
): Promise<LookupAddress[]> {
  signal.throwIfAborted();
  let onAbort = () => {};
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([lookup(hostname, { all: true }), aborted]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

/** Identifies URLs that must not be fetched from the server's network. */
export class UnsafeGameUrlError extends Error {}

/** Accepts only globally routed addresses, excluding local and transition networks. */
export function isPublicAddress(address: string): boolean {
  if (!ipaddr.isValid(address)) return false;
  const parsed = ipaddr.process(address);
  if (parsed.range() !== 'unicast') return false;
  // IPv6 destinations must also be in the currently allocated global unicast range.
  return parsed.kind() === 'ipv4' || parsed.match(ipaddr.parse('2000::'), 3);
}

/** Fetches one validated destination, pinning the connection to the checked DNS result. */
async function fetchHop(url: URL, signal: AbortSignal): Promise<Response> {
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443')
  ) {
    throw new UnsafeGameUrlError(
      'Use a public HTTPS URL on port 443 without embedded credentials.',
    );
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const family = isIP(hostname);
  const addresses = family
    ? [{ address: hostname, family }]
    : await lookupBeforeDeadline(hostname, signal);
  signal.throwIfAborted();
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new UnsafeGameUrlError('The game URL must resolve only to public internet addresses.');
  }
  const target = addresses[0];
  return new Promise((resolve, reject) => {
    const request = get(
      {
        // Do not resolve hostname a second time: that would allow DNS rebinding.
        hostname: target.address,
        family: target.family,
        port: 443,
        path: url.pathname + url.search,
        servername: family ? '' : hostname,
        checkServerIdentity: (_hostname, certificate) => checkServerIdentity(hostname, certificate),
        agent: false,
        signal,
        headers: { Host: url.host, Accept: 'application/json', 'Accept-Encoding': 'identity' },
      },
      (incoming) => {
        const status = incoming.statusCode ?? 502;
        if (REDIRECTS.has(status)) {
          const location = incoming.headers.location;
          incoming.destroy();
          resolve(new Response(null, { status, headers: location ? { Location: location } : {} }));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        incoming.on('error', reject);
        incoming.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            incoming.destroy(new Error('Game specification exceeds 16 MiB.'));
          } else {
            chunks.push(chunk);
          }
        });
        incoming.on('end', () => {
          resolve(
            new Response(
              [204, 205, 304].includes(status) ? null : Uint8Array.from(Buffer.concat(chunks)),
              { status },
            ),
          );
        });
      },
    );
    request.on('error', reject);
  });
}

/** Retrieves a bounded game document, revalidating every HTTPS redirect before connecting. */
export async function fetchGameSpecification(input: string): Promise<Response> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new UnsafeGameUrlError('The game URL must be a valid public HTTPS URL.');
  }
  const signal = AbortSignal.timeout(30000);
  for (let redirects = 0; redirects <= 5; redirects++) {
    const response = await fetchHop(url, signal);
    if (!REDIRECTS.has(response.status)) return response;
    const location = response.headers.get('location');
    if (!location) throw new Error('Upstream redirect has no destination.');
    url = new URL(location, url);
  }
  throw new Error('Too many game specification redirects.');
}
