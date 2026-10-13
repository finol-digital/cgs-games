import { lookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { get, request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { checkServerIdentity } from 'node:tls';
import { Readable, Transform, pipeline } from 'node:stream';
import ipaddr from 'ipaddr.js';

const MAX_BYTES = 16 * 1024 * 1024;
const REDIRECTS = new Set([301, 302, 303, 307, 308]);

interface PublicResourceOptions {
  method?: 'GET' | 'POST';
  body?: string;
  maxBytes?: number;
  accept?: string;
  stream?: boolean;
  signal?: AbortSignal;
}

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
async function fetchHop(
  url: URL,
  signal: AbortSignal,
  options: PublicResourceOptions,
): Promise<Response> {
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
    const method = options.method ?? 'GET';
    const maxBytes = options.maxBytes ?? MAX_BYTES;
    const connect = method === 'POST' ? httpsRequest : get;
    const request = connect(
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
        method,
        headers: {
          Host: url.host,
          // Some image hosts reject otherwise valid requests without a User-Agent.
          'User-Agent': 'CGS-Games/1.0 (+https://cgs.games)',
          Accept: options.accept ?? 'application/json',
          'Accept-Encoding': 'identity',
          ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
        },
      },
      (incoming) => {
        const status = incoming.statusCode ?? 502;
        if (REDIRECTS.has(status)) {
          const location = incoming.headers.location;
          incoming.destroy();
          resolve(new Response(null, { status, headers: location ? { Location: location } : {} }));
          return;
        }
        const headers = new Headers();
        for (const [name, value] of Object.entries(incoming.headers)) {
          if (value !== undefined) {
            for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item);
          }
        }
        const limitError = () =>
          new Error(`Upstream response exceeds ${maxBytes / (1024 * 1024)} MiB.`);
        if (Number(headers.get('content-length')) > maxBytes) {
          incoming.destroy();
          reject(limitError());
          return;
        }
        if (options.stream) {
          if ([204, 205, 304].includes(status)) {
            incoming.destroy();
            resolve(new Response(null, { status, headers }));
            return;
          }
          let size = 0;
          const limited = new Transform({
            highWaterMark: 64 * 1024,
            transform(chunk: Buffer, _encoding, callback) {
              size += chunk.length;
              callback(size > maxBytes ? limitError() : null, size > maxBytes ? undefined : chunk);
            },
          });
          // pipeline propagates upstream failures and cancellation in both directions.
          // The web stream exposes failures to the consumer; the callback handles them here.
          pipeline(incoming, limited, () => {});
          resolve(
            new Response(
              Readable.toWeb(limited, {
                strategy: {
                  highWaterMark: 64 * 1024,
                  size: (chunk: Uint8Array) => chunk.byteLength,
                },
              }) as ReadableStream<Uint8Array>,
              { status, headers },
            ),
          );
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        incoming.on('error', reject);
        incoming.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            incoming.destroy(limitError());
          } else {
            chunks.push(chunk);
          }
        });
        incoming.on('end', () => {
          resolve(
            new Response([204, 205, 304].includes(status) ? null : Buffer.concat(chunks), {
              status,
              headers,
            }),
          );
        });
      },
    );
    request.on('error', reject);
    if (method === 'POST') request.end(options.body ?? '');
  });
}

/** Retrieves a bounded game document, revalidating every HTTPS redirect before connecting. */
export async function fetchPublicResource(
  input: string,
  options: PublicResourceOptions = {},
): Promise<Response> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new UnsafeGameUrlError('The game URL must be a valid public HTTPS URL.');
  }
  const deadline = AbortSignal.timeout(30000);
  const signal = options.signal ? AbortSignal.any([deadline, options.signal]) : deadline;
  for (let redirects = 0; redirects <= 5; redirects++) {
    const response = await fetchHop(url, signal, options);
    if (!REDIRECTS.has(response.status)) return response;
    const location = response.headers.get('location');
    if (!location) throw new Error('Upstream redirect has no destination.');
    url = new URL(location, url);
    if (options.method === 'POST' && [301, 302, 303].includes(response.status)) {
      options = { ...options, method: 'GET', body: undefined };
    }
  }
  throw new Error('Too many game specification redirects.');
}

/** Retrieves a game document using the same network boundary as the public proxy. */
export async function fetchGameSpecification(input: string): Promise<Response> {
  return fetchPublicResource(input);
}
