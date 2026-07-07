import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { UserContext } from '@/lib/context';

// Mock modules before importing the component
jest.mock('firebase/auth', () => ({
  getIdToken: jest.fn().mockResolvedValue('mock-token'),
  getAuth: jest.fn(() => ({ currentUser: { uid: 'test-uid' } })),
  GoogleAuthProvider: jest.fn(),
}));

jest.mock('firebase/app', () => ({
  getApps: jest.fn(() => [{}]),
  initializeApp: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
}));

jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(() => ({})),
  ref: jest.fn((_storage, path) => ({ path })),
  uploadBytesResumable: jest.fn((_fileRef, file: File) => ({
    on: jest.fn((_event, next, _error, complete) => {
      next({ bytesTransferred: file.size, totalBytes: file.size });
      complete();
    }),
  })),
  deleteObject: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Import after mocks
import { deleteObject, ref, uploadBytesResumable } from 'firebase/storage';
import { useRouter } from 'next/navigation';
import UploadGameForm from '../components/uploadGameForm';

describe('UploadGameForm', () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    mockPush.mockClear();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (ref as jest.Mock).mockClear();
    (uploadBytesResumable as jest.Mock).mockClear();
    (deleteObject as jest.Mock).mockClear();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ slug: 'test-game' }),
    }) as jest.Mock;
  });

  const renderWithUser = (user: unknown = null, username: string | null = null) => {
    return render(
      <UserContext.Provider value={{ user, username } as any}>
        <UploadGameForm />
      </UserContext.Provider>,
    );
  };

  it('should show sign in button when user is not authenticated', () => {
    renderWithUser(null, null);
    expect(screen.getByText(/sign in/i)).toBeInTheDocument();
  });

  it('should show both upload mode tabs when user is authenticated with username', () => {
    renderWithUser({ uid: 'test-uid' }, 'testuser');
    expect(screen.getByText('Enter AutoUpdate URL')).toBeInTheDocument();
    expect(screen.getByText('Upload .cgs.zip File')).toBeInTheDocument();
  });

  it('should default to ZIP mode', () => {
    renderWithUser({ uid: 'test-uid' }, 'testuser');
    expect(screen.getByLabelText(/Upload .cgs.zip file/i)).toBeInTheDocument();
  });

  it('should switch to URL mode when tab is clicked', async () => {
    renderWithUser({ uid: 'test-uid' }, 'testuser');
    const user = userEvent.setup();

    await user.click(screen.getByText('Enter AutoUpdate URL'));
    expect(screen.getByLabelText(/Enter CGS AutoUpdate Url/i)).toBeInTheDocument();
  });

  it('should switch back to ZIP mode when tab is clicked', async () => {
    renderWithUser({ uid: 'test-uid' }, 'testuser');
    const user = userEvent.setup();

    await user.click(screen.getByText('Upload .cgs.zip File'));
    await user.click(screen.getByText('Enter AutoUpdate URL'));
    expect(screen.getByLabelText(/Enter CGS AutoUpdate Url/i)).toBeInTheDocument();
  });

  it('should upload zip files to Storage before requesting server processing', async () => {
    renderWithUser({ uid: 'test-uid' }, 'testuser');
    const user = userEvent.setup();

    await user.click(screen.getByText('Upload .cgs.zip File'));
    await user.upload(
      screen.getByLabelText(/Upload .cgs.zip file/i),
      new File(['zip-content'], 'test-game.cgs.zip', { type: 'application/zip' }),
    );
    await user.click(screen.getByRole('button', { name: 'Upload .cgs.zip to CGS Games' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    expect(ref).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringMatching(/^staged-uploads\/test-uid\/[A-Za-z0-9_-]+\.cgs\.zip$/),
    );
    expect(uploadBytesResumable).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('staged-uploads/test-uid/') }),
      expect.objectContaining({ name: 'test-game.cgs.zip' }),
      { contentType: 'application/zip' },
    );

    const [, requestInit] = (global.fetch as jest.Mock).mock.calls[0];
    expect(requestInit).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token',
        },
      }),
    );
    expect(JSON.parse(requestInit.body)).toEqual({
      stagedPath: expect.stringMatching(/^staged-uploads\/test-uid\/[A-Za-z0-9_-]+\.cgs\.zip$/),
      originalFilename: 'test-game.cgs.zip',
    });
    expect(mockPush).toHaveBeenCalledWith('/testuser/test-game');
  });
});
