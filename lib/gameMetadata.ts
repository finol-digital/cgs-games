// Game metadata is rendered on shared pages (home, browse, creator), so a single malformed
// listing must never be able to break them. Validate every value before it is stored.

export const MAX_GAME_NAME_LENGTH = 200;
export const MAX_COPYRIGHT_LENGTH = 500;
export const MAX_URL_LENGTH = 2048;

/** Accepts only absolute HTTPS URLs of a bounded length. */
export function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > MAX_URL_LENGTH) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Returns an error message for an invalid game name or copyright, or null when both can be
 * stored and rendered safely. A missing or empty copyright is allowed (it defaults to the creator).
 */
export function validateGameMetadata(metadata: { name: unknown; copyright?: unknown }) {
  const { name, copyright } = metadata;
  if (typeof name !== 'string' || !name.trim()) return "missing required 'name' field";
  if (name.length > MAX_GAME_NAME_LENGTH)
    return `'name' must be at most ${MAX_GAME_NAME_LENGTH} characters`;
  if (copyright !== undefined && copyright !== null && typeof copyright !== 'string')
    return "'copyright' must be a string";
  if (typeof copyright === 'string' && copyright.length > MAX_COPYRIGHT_LENGTH)
    return `'copyright' must be at most ${MAX_COPYRIGHT_LENGTH} characters`;
  return null;
}
