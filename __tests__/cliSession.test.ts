/** @jest-environment node */
import { POST } from '@/app/api/cli/session/route';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase/admin';

jest.mock('@/lib/firebase/admin', () => ({
  adminAuth: { verifyIdToken: jest.fn() },
  adminDb: { collection: jest.fn() },
  adminStorage: { bucket: jest.fn() },
}));
const get = jest.fn();
const request = (token?: string) =>
  new Request('https://cgs.games/api/cli/session', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
beforeEach(() => {
  jest.resetAllMocks();
  (adminAuth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: 'creator-id', exp: 2000000000 });
  (adminDb.collection as jest.Mock).mockReturnValue({ doc: () => ({ get }) });
  get.mockResolvedValue({ data: () => ({ username: 'creator' }) });
  (adminStorage.bucket as jest.Mock).mockReturnValue({ name: 'cgs-games.appspot.com' });
});

describe('CLI session verification', () => {
  it('requires a bearer token before accessing account data', async () => {
    expect((await POST(request())).status).toBe(401);
    expect(adminAuth.verifyIdToken).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });
  it('verifies revocation and returns only session metadata without caching', async () => {
    const response = await POST(request('fixture-token'));
    expect(adminAuth.verifyIdToken).toHaveBeenCalledWith('fixture-token', true);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      uid: 'creator-id',
      username: 'creator',
      expiresAt: new Date(2000000000000).toISOString(),
      storageBucket: 'cgs-games.appspot.com',
    });
  });
  it('rejects invalid, expired or revoked tokens without leaking verifier details', async () => {
    (adminAuth.verifyIdToken as jest.Mock).mockRejectedValue(new Error('secret verifier details'));
    const response = await POST(request('fixture-token'));
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain('secret');
    expect(get).not.toHaveBeenCalled();
  });
  it('allows sign-in before creator onboarding without creating a profile', async () => {
    get.mockResolvedValue({ data: () => undefined });
    expect((await (await POST(request('fixture-token'))).json()).username).toBeNull();
  });
  it('returns a retryable failure when profile lookup fails', async () => {
    get.mockRejectedValue(new Error('private details'));
    const response = await POST(request('fixture-token'));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private');
  });
});
