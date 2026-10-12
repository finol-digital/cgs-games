/** Collects only exact owner/game prefixes; corrupt records must never hide orphaned files. */
export function auditStoragePrefixes(games, registry) {
  const prefixes = new Set();
  const findings = [];
  const segment = (value) =>
    typeof value === 'string' &&
    value.length > 0 &&
    value !== '.' &&
    value !== '..' &&
    !value.includes('/') &&
    !value.includes('\\') &&
    !Array.from(value).some((character) => character.charCodeAt(0) < 32);
  for (const { id, data } of games) {
    if (!data.storageBasePath) continue;
    const uid = registry.get(data.username);
    if (
      !segment(uid) ||
      !segment(data.slug) ||
      data.storageBasePath !== `games/${uid}/${data.slug}`
    ) {
      findings.push({
        type: 'unsafe_storage_prefix',
        gameId: id,
        storageBasePath: data.storageBasePath,
      });
    } else {
      prefixes.add(data.storageBasePath + '/');
    }
  }
  return { prefixes, findings };
}
