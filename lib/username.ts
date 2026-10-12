import reservedUsernames from '@/lib/reservedUsernames.json';

const reserved = new Set(reservedUsernames);

/** Keeps application and asset namespaces unavailable to new creator accounts. */
export function isReservedUsername(username: string): boolean {
  return reserved.has(username.toLowerCase());
}

/** Mirrors the Firestore creation policy; existing profiles are not renamed or invalidated. */
export function isValidUsername(username: string): boolean {
  return (
    username === username.trim() &&
    /^[a-z0-9-][a-z0-9._-]{1,13}[a-z0-9-]$/.test(username) &&
    !/[_.]{2}/.test(username) &&
    !isReservedUsername(username)
  );
}
