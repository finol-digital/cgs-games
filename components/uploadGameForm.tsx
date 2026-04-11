'use client';

import React, { useContext, useRef, useState } from 'react';
import { UserContext } from '@/lib/context';
import { auth } from '@/lib/firebase/firebase';
import { getIdToken } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import SignInButton from './signInButton';
import UsernameForm from './usernameForm';

export default function UploadGameForm() {
  const { user, username } = useContext(UserContext);
  return <>{user ? username ? <GameUploadForm /> : <UsernameForm /> : <SignInButton />}</>;
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

type UploadMode = 'url' | 'zip';

const MAX_ZIP_SIZE = 100 * 1024 * 1024; // 100MB

function GameUploadForm() {
  const [mode, setMode] = useState<UploadMode>('url');

  return (
    <section>
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition ${
            mode === 'url'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
          }`}
        >
          Enter AutoUpdate URL
        </button>
        <button
          type="button"
          onClick={() => setMode('zip')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition ${
            mode === 'zip'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
          }`}
        >
          Upload .cgs.zip File
        </button>
      </div>
      {mode === 'url' ? <AutoUpdateUrlForm /> : <ZipUploadForm />}
    </section>
  );
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
    } catch (err: unknown) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  return (
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
  );
}

function ZipUploadForm() {
  const router = useRouter();
  const { username } = useContext(UserContext);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!file.name.endsWith('.cgs.zip')) {
      setError('Only .cgs.zip files are accepted');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_ZIP_SIZE) {
      setError('File exceeds maximum size of 100MB');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
  };

  const submitZipFile = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError('');

    if (!selectedFile) {
      setError('Please select a .cgs.zip file');
      return;
    }

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
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/games/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload game');
      }

      setLoading(false);
      router.push(`/${username}/${data.slug}`);
    } catch (err: unknown) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  return (
    <form onSubmit={submitZipFile}>
      <label htmlFor="zipFile" className="block">
        Upload .cgs.zip file:
      </label>
      <input
        type="file"
        name="zipFile"
        id="zipFile"
        ref={fileInputRef}
        accept=".cgs.zip,.zip"
        onChange={handleFileChange}
        className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition file:mr-4 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700"
      />
      {selectedFile && (
        <p className="mt-2 text-sm text-gray-400">
          Selected: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)
        </p>
      )}
      <br />
      {error && <p className="text-danger">{error}</p>}
      {!error && <p />}
      {loading ? (
        <p className="text-gray-400">
          Uploading and processing game files... This may take a moment.
        </p>
      ) : (
        <button type="submit" disabled={!selectedFile}>
          Upload .cgs.zip to CGS Games
        </button>
      )}
    </form>
  );
}
