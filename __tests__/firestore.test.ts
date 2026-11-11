import { db, userDoc } from '@/lib/firebase/firestore';
import { doc } from 'firebase/firestore';

jest.mock('@/lib/firebase/firebase', () => ({
  firebaseApp: { name: 'mockApp' },
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({ name: 'mockDb' })),
  doc: jest.fn(),
  onSnapshot: jest.fn(),
}));

const docMock = doc as jest.Mock;

describe('firestore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    docMock.mockImplementation((dbValue, collectionName, id) => ({
      type: 'doc',
      dbValue,
      collectionName,
      id,
    }));
  });

  it('returns a user doc reference', () => {
    const result = userDoc('user-123');

    expect(docMock).toHaveBeenCalledWith(db, 'users', 'user-123');
    expect(result).toEqual({
      type: 'doc',
      dbValue: db,
      collectionName: 'users',
      id: 'user-123',
    });
  });
});
