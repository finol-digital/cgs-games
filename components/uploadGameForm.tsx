'use client';

import { UserContext } from '@/lib/context';
import { auth } from '@/lib/firebase/firebase';
import { getIdToken } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useContext, useState } from 'react';
import SignInButton from './signInButton';
import UsernameForm from './usernameForm';

export default function UploadGameForm() {
  const { user, username } = useContext(UserContext);
  return <>{user ? username ? <AutoUpdateUrlForm /> : <UsernameForm /> : <SignInButton />}</>;
}

function isValidHttpsUrl(string: string) {
  let url;

  try {
    url = new URL(string);
  } catch {
    return false;
  }

  return url.protocol === 'https:';
}

function AutoUpdateUrlForm() {
  const router = useRouter();
  const { username } = useContext(UserContext);
  const [autoUpdateUrl, setAutoUpdateUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  let isValid = false;
  if (!loading) {
    const isValidUrl = isValidHttpsUrl(autoUpdateUrl);
    const inputError = isValidUrl ? '' : 'Please input valid https url';
    if (error != inputError) setError(inputError);
    isValid = isValidUrl;
  }

  const submitAutoUpdateUrl = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError('');
    try {
      if (!username) {
        throw new Error('No username!');
      }
      setLoading(true);

      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      const idToken = await getIdToken(currentUser);
      const response = await fetch('/api/games', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          autoUpdateUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create game');
      }

      setLoading(false);
      router.push(`/${username}/${data.slug}`);
    } catch (err: any) {
      setLoading(false);
      setError(err.message);
    }
  };

  return (
    <section>
      <form onSubmit={submitAutoUpdateUrl}>
        <label htmlFor="autoUpdateUrl" className="block">
          Enter CGS AutoUpdate Url:
        </label>
        <input
          type="text"
          name="autoUpdateUrl"
          id="autoUpdateUrl"
          value={autoUpdateUrl}
          onChange={(e) => setAutoUpdateUrl(e.target.value)}
          required
          className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
          placeholder="https://www.cardgamesimulator.com/games/Standard/cgs.json"
        />
        <br />
        {error && <p className="text-danger">{error}</p>}
        {!error && <p />}
        <button type="submit" disabled={!isValid}>
          Submit AutoUpdate Url to CGS Games
        </button>
      </form>
    </section>
  );
}
