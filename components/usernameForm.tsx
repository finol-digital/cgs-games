'use client';

import { UserContext } from '@/lib/context';
import { db } from '@/lib/firebase/firestore';
import { isReservedUsername, isValidUsername } from '@/lib/username';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { useContext, useEffect, useState } from 'react';

/** Validates names before lookup and ignores results belonging to an earlier input. */
export default function UsernameForm() {
  const [formValue, setFormValue] = useState('');
  const [lookup, setLookup] = useState<{
    username: string;
    available: boolean;
    failed?: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { user, username } = useContext(UserContext);
  const eligible = isValidUsername(formValue);
  const loading = eligible && lookup?.username !== formValue;
  const isValid = eligible && !loading && lookup?.available === true;

  useEffect(() => {
    if (!eligible) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const snapshot = await getDoc(doc(db, 'usernames', formValue));
        if (active) setLookup({ username: formValue, available: !snapshot.exists() });
      } catch {
        if (active) setLookup({ username: formValue, available: false, failed: true });
      }
    }, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [formValue, eligible]);

  const onSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    // Recheck at submission; a disabled button alone is not an authorization boundary.
    if (!user || username || !isValid || !isValidUsername(formValue) || saving) return;
    setSaving(true);
    setError('');
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', user.uid), { username: formValue });
      batch.set(doc(db, 'usernames', formValue), { uid: user.uid });
      await batch.commit();
    } catch {
      setLookup({ username: formValue, available: false });
      setError('Could not save this username. It may have just been taken. Please try another.');
    } finally {
      setSaving(false);
    }
  };

  let message = '';
  if (formValue) {
    if (isReservedUsername(formValue)) message = 'That username is reserved for CGS Games.';
    else if (!eligible)
      message =
        'Use 3–15 lowercase letters, numbers, dots, underscores or hyphens. Dots and underscores cannot be at the ends or next to each other.';
    else if (loading) message = 'Checking...';
    else if (lookup?.failed) message = 'Could not check availability. Please try again.';
    else message = isValid ? `${formValue} is available!` : 'That username is taken!';
  }

  return (
    !username && (
      <section>
        <h2>Choose Username</h2>
        <form onSubmit={onSubmit}>
          <input
            name="username"
            aria-label="Username"
            placeholder="myname"
            value={formValue}
            maxLength={15}
            disabled={saving}
            onChange={(e) => {
              const nextValue = e.target.value.toLowerCase();
              if (nextValue === formValue) return;
              setFormValue(nextValue);
              setLookup(null);
              setError('');
            }}
          />
          <p
            className={loading || !formValue ? undefined : isValid ? 'text-success' : 'text-danger'}
            aria-live="polite"
          >
            {message}
          </p>
          {error && <p role="alert">{error}</p>}
          <button type="submit" className="btn-green" disabled={!isValid || saving}>
            {saving ? 'Saving...' : 'Choose'}
          </button>
          <div>
            Username: {formValue}
            <br />
            Loading: {loading.toString()}
            <br />
            Username Valid: {isValid.toString()}
          </div>
        </form>
      </section>
    )
  );
}
