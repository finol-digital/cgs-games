'use client';

import { useContext, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { UserContext } from '@/lib/context';
import { parseCliCallback } from '@/lib/cliCallback';
import SignInButton from '@/components/signInButton';

/** Subscribes to callback changes without putting them in server-rendered HTML. */
function subscribeToFragment(change: () => void) {
  window.addEventListener('hashchange', change);
  return () => window.removeEventListener('hashchange', change);
}

/** Requires an explicit user gesture before posting a token to a validated local callback. */
export default function CliAuthorization() {
  const { user, username } = useContext(UserContext);
  const fragment = useSyncExternalStore(
    subscribeToFragment,
    () => window.location.hash,
    () => '',
  );
  const target = parseCliCallback(fragment);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function authorize() {
    if (!target || !user || busy) return;
    setBusy(true);
    setError('');
    try {
      const token = await user.getIdToken(true);
      // A form POST keeps credentials out of URLs, logs and referrers and needs no cross-origin fetch.
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = target.callback;
      for (const [name, value] of Object.entries({ state: target.state, token })) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
      form.remove();
    } catch {
      setError('Could not authorize the CLI. Run auth login again and retry.');
      setBusy(false);
    }
  }

  if (!target)
    return (
      <p>
        Start with <code>cgs-games auth login</code> and open the link it prints.
      </p>
    );
  if (!user) return <SignInButton />;
  return (
    <section>
      <p>Signed in as {user.email || user.displayName || 'your Google account'}.</p>
      {!username && (
        <p>
          Before uploading,{' '}
          <Link href="/upload" prefetch={false}>
            choose a creator username
          </Link>
          , then return here.
        </p>
      )}
      <p>
        Send this sign-in to the CLI on this computer: <code>{target.callback}</code>
      </p>
      <button onClick={authorize} disabled={busy}>
        {busy ? 'Authorizing…' : 'Authorize CLI'}
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
