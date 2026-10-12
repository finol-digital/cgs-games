import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { User } from 'firebase/auth';
import { UserContext } from '@/lib/context';
import CliAuthorization from '@/components/cliAuthorization';
import { parseCliCallback } from '@/lib/cliCallback';

jest.mock(
  '@/components/signInButton',
  () =>
    function MockSignIn() {
      return <button>Sign in with Google</button>;
    },
);
const state = 'a'.repeat(64);
const fragment = (callback: string) => '#' + new URLSearchParams({ callback, state });

describe('CLI browser approval', () => {
  it.each([
    'https://evil.example/callback',
    'http://localhost:3333/callback',
    'http://127.0.0.1:80/callback',
    'http://127.0.0.1:3333/other',
    'http://127.0.0.1:3333/callback?token=secret',
    'http://user@127.0.0.1:3333/callback',
  ])('rejects callback %s', (url) => {
    expect(parseCliCallback(fragment(url))).toBeNull();
  });
  it('rejects missing or malformed state', () => {
    expect(parseCliCallback('#callback=http://127.0.0.1:3333/callback&state=short')).toBeNull();
  });
  it('requires explicit approval and posts credentials in the form body only', async () => {
    window.location.hash = fragment('http://127.0.0.1:3333/callback');
    const getIdToken = jest.fn().mockResolvedValue('fixture-token');
    const user = { email: 'creator@example.test', getIdToken } as unknown as User;
    const submit = jest.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(function () {
      const form = document.querySelector('form')!;
      expect(form.method).toBe('post');
      expect(form.action).toBe('http://127.0.0.1:3333/callback');
      expect(new FormData(form).get('token')).toBe('fixture-token');
      expect(new FormData(form).get('state')).toBe(state);
    });
    try {
      render(
        <UserContext.Provider value={{ user, username: 'creator' }}>
          <CliAuthorization />
        </UserContext.Provider>,
      );
      expect(getIdToken).not.toHaveBeenCalled();
      fireEvent.click(await screen.findByRole('button', { name: 'Authorize CLI' }));
      await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
      expect(getIdToken).toHaveBeenCalledWith(true);
    } finally {
      submit.mockRestore();
      window.location.hash = '';
    }
  });
});
