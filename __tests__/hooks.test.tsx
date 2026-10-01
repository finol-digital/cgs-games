import { act, renderHook, waitFor } from '@testing-library/react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { subscribeToUsername } from '@/lib/firebase/firestore';
import { useUserData } from '@/lib/hooks';

jest.mock('@/lib/firebase/firebase', () => ({ auth: {} }));
jest.mock('react-firebase-hooks/auth', () => ({ useAuthState: jest.fn() }));
jest.mock('@/lib/firebase/firestore', () => ({ subscribeToUsername: jest.fn() }));

const authStateMock = jest.mocked(useAuthState);
const subscribeMock = jest.mocked(subscribeToUsername);
const setUser = (uid: string | null) => {
  authStateMock.mockReturnValue([
    uid ? ({ uid } as NonNullable<ReturnType<typeof useAuthState>[0]>) : null,
    false,
    undefined,
  ]);
};

describe('useUserData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    subscribeMock.mockReturnValue(jest.fn());
    setUser(null);
  });

  it('does not subscribe to Firestore for anonymous visitors', async () => {
    const { result } = renderHook(() => useUserData());
    await act(async () => {});
    expect(subscribeMock).not.toHaveBeenCalled();
    expect(result.current.username).toBeNull();
  });

  it('loads a signed-in profile and clears it immediately on sign-out', async () => {
    const unsubscribe = jest.fn();
    subscribeMock.mockReturnValue(unsubscribe);
    setUser('alice');
    const { result, rerender } = renderHook(() => useUserData());
    await waitFor(() => expect(subscribeMock).toHaveBeenCalledTimes(1));
    act(() => subscribeMock.mock.calls[0][1]('alice-games'));
    expect(result.current.username).toBe('alice-games');

    setUser(null);
    rerender();
    expect(result.current.username).toBeNull();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    act(() => subscribeMock.mock.calls[0][1]('stale-name'));
    expect(result.current.username).toBeNull();
  });

  it('does not expose the previous account name while switching users', async () => {
    setUser('alice');
    const { result, rerender } = renderHook(() => useUserData());
    await waitFor(() => expect(subscribeMock).toHaveBeenCalledTimes(1));
    act(() => subscribeMock.mock.calls[0][1]('alice-games'));

    setUser('bob');
    rerender();
    expect(result.current.username).toBeNull();
    await waitFor(() => expect(subscribeMock).toHaveBeenCalledTimes(2));
    act(() => subscribeMock.mock.calls[1][1]('bob-games'));
    expect(result.current.username).toBe('bob-games');
  });

  it('does not create a listener when unmounted before the module loads', async () => {
    setUser('alice');
    const { unmount } = renderHook(() => useUserData());
    unmount();
    await act(async () => {});
    expect(subscribeMock).not.toHaveBeenCalled();
  });
});
