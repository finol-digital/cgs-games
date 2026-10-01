/** @jest-environment node */
import { adminCreatorExists, adminDb } from '@/lib/firebase/admin';

jest.mock('firebase-admin/app', () => ({ getApps: () => [{}] }));
jest.mock('firebase-admin/auth', () => ({ getAuth: () => ({}) }));
jest.mock('firebase-admin/storage', () => ({ getStorage: () => ({}) }));
jest.mock('firebase-admin/firestore', () => ({ getFirestore: () => ({ collection: jest.fn() }) }));

describe('creator existence', () => {
  const get = jest.fn();
  beforeEach(() => {
    jest.resetAllMocks();
    (adminDb.collection as jest.Mock).mockReturnValue({
      where: () => ({ limit: () => ({ get }) }),
    });
  });
  it('recognizes a registered creator even without games', async () => {
    get.mockResolvedValueOnce({ empty: false });
    expect(await adminCreatorExists('new-creator')).toBe(true);
    expect(get).toHaveBeenCalledTimes(1);
  });
  it('preserves older collections without a matching user document', async () => {
    get.mockResolvedValueOnce({ empty: true }).mockResolvedValueOnce({ empty: false });
    expect(await adminCreatorExists('old-creator')).toBe(true);
  });
  it('rejects a username absent from both users and games', async () => {
    get.mockResolvedValue({ empty: true });
    expect(await adminCreatorExists('missing')).toBe(false);
  });
  it('propagates outages instead of misreporting missing resources', async () => {
    get.mockRejectedValue(new Error('unavailable'));
    await expect(adminCreatorExists('creator')).rejects.toThrow('unavailable');
  });
});
