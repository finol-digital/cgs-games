import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { UserContext } from '@/lib/context';

// Mock modules before importing the component
jest.mock('firebase/auth', () => ({
  getIdToken: jest.fn().mockResolvedValue('mock-token'),
  getAuth: jest.fn(),
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
  getStorage: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Import after mocks
import UploadGameForm from '../components/uploadGameForm';

describe('UploadGameForm', () => {
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

  it('should default to URL mode', () => {
    renderWithUser({ uid: 'test-uid' }, 'testuser');
    expect(screen.getByLabelText(/Enter CGS AutoUpdate Url/i)).toBeInTheDocument();
  });

  it('should switch to zip upload mode when tab is clicked', async () => {
    renderWithUser({ uid: 'test-uid' }, 'testuser');
    const user = userEvent.setup();

    await user.click(screen.getByText('Upload .cgs.zip File'));
    expect(screen.getByLabelText(/Upload .cgs.zip file/i)).toBeInTheDocument();
  });

  it('should switch back to URL mode when tab is clicked', async () => {
    renderWithUser({ uid: 'test-uid' }, 'testuser');
    const user = userEvent.setup();

    await user.click(screen.getByText('Upload .cgs.zip File'));
    await user.click(screen.getByText('Enter AutoUpdate URL'));
    expect(screen.getByLabelText(/Enter CGS AutoUpdate Url/i)).toBeInTheDocument();
  });
});
