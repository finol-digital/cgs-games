/** @jest-environment node */
import { lookup } from 'node:dns/promises';
import { EventEmitter } from 'node:events';
import { get, request, RequestOptions } from 'node:https';
import { IncomingMessage } from 'node:http';
import { PassThrough, Readable } from 'node:stream';
import {
  fetchGameSpecification,
  fetchPublicResource,
  isPublicAddress,
  UnsafeGameUrlError,
} from '@/lib/fetchGameSpecification';

jest.mock('node:dns/promises', () => ({ lookup: jest.fn() }));
jest.mock('node:https', () => ({ get: jest.fn(), request: jest.fn() }));

/** Supplies a mock upstream response without making a network connection. */
function respond(status = 200, body = '{"name":"Test Game"}', headers = {}) {
  (get as jest.Mock).mockImplementationOnce(
    // eslint-disable-next-line no-unused-vars -- This parameter describes the callback type.
    (_options: RequestOptions, callback: (response: IncomingMessage) => void) => {
      const incoming = Object.assign(new PassThrough(), { statusCode: status, headers });
      queueMicrotask(() => {
        callback(incoming as unknown as IncomingMessage);
        incoming.end(body);
      });
      return new EventEmitter();
    },
  );
}

beforeEach(() => {
  jest.resetAllMocks();
  (lookup as jest.Mock).mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
});

/** Delivers headers without ending the body, like a real streaming HTTPS peer. */
function streamResponse(incoming: Readable, headers = {}) {
  Object.assign(incoming, { statusCode: 200, headers });
  (get as jest.Mock).mockImplementationOnce((options, callback) => {
    options.signal.addEventListener('abort', () => incoming.destroy(options.signal.reason), {
      once: true,
    });
    queueMicrotask(() => callback(incoming));
    return new EventEmitter();
  });
}

describe('bounded streaming public resources', () => {
  it('delivers headers and initial bytes before the upstream ends', async () => {
    const incoming = new PassThrough();
    streamResponse(incoming, { 'content-type': 'image/png' });
    const response = await fetchPublicResource('https://example.com/image', {
      stream: true,
      maxBytes: 6,
    });
    expect(response.headers.get('content-type')).toBe('image/png');
    const reader = response.body!.getReader();
    incoming.write(Buffer.from('abc'));
    expect(Buffer.from((await reader.read()).value!).toString()).toBe('abc');
    incoming.end('def');
    expect(Buffer.from((await reader.read()).value!).toString()).toBe('def');
    expect((await reader.read()).done).toBe(true);
  });

  it('aborts an unknown-length stream on overflow without forwarding the excess chunk', async () => {
    const incoming = new PassThrough();
    streamResponse(incoming);
    const response = await fetchPublicResource('https://example.com/image', {
      stream: true,
      maxBytes: 3,
    });
    const reader = response.body!.getReader();
    incoming.write(Buffer.from('abc'));
    expect(Buffer.from((await reader.read()).value!).toString()).toBe('abc');
    const excess = reader.read();
    incoming.write(Buffer.from('d'));
    await expect(excess).rejects.toThrow('exceeds');
    expect(incoming.destroyed).toBe(true);
  });

  it('rejects an oversized declared length before returning a streaming response', async () => {
    const incoming = new PassThrough();
    streamResponse(incoming, { 'content-length': '4' });
    await expect(
      fetchPublicResource('https://example.com/image', { stream: true, maxBytes: 3 }),
    ).rejects.toThrow('exceeds');
    expect(incoming.destroyed).toBe(true);
  });

  it('applies backpressure and destroys the upstream when the client cancels', async () => {
    let produced = 0;
    const incoming = new Readable({
      read() {
        if (++produced > 128) this.push(null);
        else this.push(Buffer.alloc(64 * 1024));
      },
    });
    streamResponse(incoming);
    const response = await fetchPublicResource('https://example.com/image', {
      stream: true,
      maxBytes: 100 * 1024 * 1024,
    });
    await new Promise(setImmediate);
    expect(produced).toBeLessThan(10);
    await response.body!.cancel();
    await new Promise(setImmediate);
    expect(incoming.destroyed).toBe(true);
  });

  it.each(['deadline', 'client'])('propagates %s cancellation after headers', async (reason) => {
    const controller = new AbortController();
    const timeout =
      reason === 'deadline'
        ? jest.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal)
        : undefined;
    try {
      const incoming = new PassThrough();
      streamResponse(incoming);
      const response = await fetchPublicResource('https://example.com/image', {
        stream: true,
        ...(reason === 'client' ? { signal: controller.signal } : {}),
      });
      const reading = response.text();
      controller.abort(new Error('cancelled by ' + reason));
      await expect(reading).rejects.toThrow('cancelled by ' + reason);
      expect(incoming.destroyed).toBe(true);
    } finally {
      timeout?.mockRestore();
    }
  });

  it('propagates upstream connection failures after headers', async () => {
    const incoming = new PassThrough();
    streamResponse(incoming);
    const response = await fetchPublicResource('https://example.com/image', { stream: true });
    const reading = response.text();
    incoming.destroy(new Error('upstream disconnected'));
    await expect(reading).rejects.toThrow('upstream disconnected');
  });
});

describe('safe game specification retrieval', () => {
  it('applies the same DNS boundary to POST without connecting to private hosts', async () => {
    await expect(
      fetchPublicResource('https://169.254.169.254/', { method: 'POST', body: '{}' }),
    ).rejects.toBeInstanceOf(UnsafeGameUrlError);
    expect(request).not.toHaveBeenCalled();
  });

  it('pins POST destinations, retains response headers and sends only the explicit body', async () => {
    const end = jest.fn();
    (request as jest.Mock).mockImplementationOnce((_options, callback) => {
      const incoming = Object.assign(new PassThrough(), {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
      });
      queueMicrotask(() => {
        callback(incoming);
        incoming.end('{}');
      });
      return Object.assign(new EventEmitter(), { end });
    });
    const response = await fetchPublicResource('https://example.com/resource', {
      method: 'POST',
      body: '{"a":1}',
    });
    expect(end).toHaveBeenCalledWith('{"a":1}');
    expect((request as jest.Mock).mock.calls[0][0]).toMatchObject({
      hostname: '93.184.216.34',
      method: 'POST',
      headers: { Host: 'example.com', 'Content-Type': 'application/json' },
    });
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(await response.text()).toBe('{}');
  });

  it.each([302, 307])('revalidates POST redirect %i destinations', async (status) => {
    (request as jest.Mock).mockImplementationOnce((_options, callback) => {
      queueMicrotask(() =>
        callback(
          Object.assign(new PassThrough(), {
            statusCode: status,
            headers: { location: 'https://10.0.0.1/private' },
          }),
        ),
      );
      return Object.assign(new EventEmitter(), { end: jest.fn() });
    });
    await expect(
      fetchPublicResource('https://example.com/resource', { method: 'POST', body: '{}' }),
    ).rejects.toBeInstanceOf(UnsafeGameUrlError);
    expect(request).toHaveBeenCalledTimes(1);
    expect(get).not.toHaveBeenCalled();
  });
  it.each([
    '127.0.0.1',
    '0.0.0.0',
    '10.0.0.1',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '198.18.0.1',
    '192.0.2.1',
    '224.0.0.1',
    '::1',
    '::',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '2002:7f00:1::',
    '2001:db8::1',
    '64:ff9b::7f00:1',
  ])('rejects non-public address %s', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(['93.184.216.34', '2606:4700:4700::1111'])('allows public address %s', (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it.each([
    'garbage',
    'http://example.com/game.json',
    'https://user:password@example.com/game.json',
    'https://example.com:8443/game.json',
    'https://127.0.0.1/',
    'https://2130706433/',
    'https://0x7f000001/',
    'https://[::ffff:127.0.0.1]/',
  ])('rejects unsafe URL %s before connecting', async (url) => {
    await expect(fetchGameSpecification(url)).rejects.toBeInstanceOf(UnsafeGameUrlError);
    expect(get).not.toHaveBeenCalled();
  });

  it('rejects private DNS results, including mixed public/private answers', async () => {
    (lookup as jest.Mock).mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ]);
    await expect(fetchGameSpecification('https://example.com/game.json')).rejects.toBeInstanceOf(
      UnsafeGameUrlError,
    );
    expect(get).not.toHaveBeenCalled();
  });

  it('pins the connection to a validated IP while preserving Host and TLS identity', async () => {
    respond();
    const response = await fetchGameSpecification('https://example.com/game.json?version=2');
    expect(await response.json()).toEqual({ name: 'Test Game' });
    const options = (get as jest.Mock).mock.calls[0][0];
    expect(options).toMatchObject({
      hostname: '93.184.216.34',
      port: 443,
      path: '/game.json?version=2',
      servername: 'example.com',
      headers: { Host: 'example.com' },
      agent: false,
    });
    expect(
      options.checkServerIdentity('ignored', { subjectaltname: 'DNS:attacker.example' }),
    ).toMatchObject({ code: 'ERR_TLS_CERT_ALTNAME_INVALID' });
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it('revalidates redirects and refuses a redirect to cloud metadata', async () => {
    respond(302, '', { location: 'https://169.254.169.254/latest/meta-data/' });
    await expect(fetchGameSpecification('https://example.com/game.json')).rejects.toBeInstanceOf(
      UnsafeGameUrlError,
    );
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('follows bounded relative public redirects', async () => {
    respond(302, '', { location: '/final.json' });
    respond();
    expect((await fetchGameSpecification('https://example.com/game.json')).status).toBe(200);
    expect((get as jest.Mock).mock.calls[1][0].path).toBe('/final.json');
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it('rejects redirect loops and oversized bodies', async () => {
    for (let i = 0; i < 6; i++) respond(302, '', { location: '/again' });
    await expect(fetchGameSpecification('https://example.com/game.json')).rejects.toThrow(
      'Too many',
    );
    respond(200, 'x'.repeat(16 * 1024 * 1024 + 1));
    await expect(fetchGameSpecification('https://example.com/game.json')).rejects.toThrow('16 MiB');
  });

  it('honors the request deadline even while waiting for DNS', async () => {
    const controller = new AbortController();
    const timeout = jest.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    (lookup as jest.Mock).mockReturnValue(new Promise(() => {}));
    try {
      const result = fetchGameSpecification('https://example.com/game.json');
      controller.abort(new Error('Request deadline reached'));
      await expect(result).rejects.toThrow('Request deadline reached');
      expect(get).not.toHaveBeenCalled();
    } finally {
      timeout.mockRestore();
    }
  });
});
