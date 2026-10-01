/** @jest-environment node */
import { lookup } from 'node:dns/promises';
import { EventEmitter } from 'node:events';
import { get, RequestOptions } from 'node:https';
import { IncomingMessage } from 'node:http';
import { PassThrough } from 'node:stream';
import {
  fetchGameSpecification,
  isPublicAddress,
  UnsafeGameUrlError,
} from '@/lib/fetchGameSpecification';

jest.mock('node:dns/promises', () => ({ lookup: jest.fn() }));
jest.mock('node:https', () => ({ get: jest.fn() }));

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

describe('safe game specification retrieval', () => {
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
