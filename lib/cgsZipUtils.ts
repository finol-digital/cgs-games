import JSZip from 'jszip';

export const ALLOWED_EXTENSIONS = new Set([
  '.json',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.txt',
  '.dec',
  '.hsd',
  '.ydk',
  '.lor',
]);

export const CONTENT_TYPE_MAP: Record<string, string> = {
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.txt': 'text/plain',
  '.dec': 'text/plain',
  '.hsd': 'text/plain',
  '.ydk': 'text/plain',
  '.lor': 'text/plain',
};

export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot >= 0 ? filename.substring(lastDot).toLowerCase() : '';
}

export function isAllowedFile(filename: string): boolean {
  if (filename.endsWith('/') || filename.startsWith('.') || filename.includes('/.')) {
    return false;
  }
  const ext = getFileExtension(filename);
  return ALLOWED_EXTENSIONS.has(ext);
}

export function getPublicUrl(bucket: string, filePath: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(
    filePath,
  )}?alt=media`;
}

export interface CgsJson {
  name: string;
  autoUpdateUrl?: string | null;
  bannerImageUrl?: string | null;
  bannerImageFileType?: string;
  cardBackImageUrl?: string | null;
  cardBackImageFileType?: string;
  playMatImageUrl?: string | null;
  playMatImageFileType?: string;
  allCardsUrl?: string | null;
  allSetsUrl?: string | null;
  allDecksUrl?: string | null;
  cardImageUrl?: string;
  cardImageFileType?: string;
  cgsGamesLink?: string | null;
  copyright?: string;
  gameBoardUrls?: Array<{ id?: string; url?: string }>;
  gameBoardImageFileType?: string;
  deckUrls?: Array<{ name?: string; url?: string; txt?: string; isAvailable?: boolean }>;
  deckFileType?: string;
  cardBackFaceImageUrls?: Array<{ id?: string; url?: string }>;
  [key: string]: unknown;
}

export function findFileInZip(
  zip: JSZip,
  relativePath: string,
  gameRoot: string,
): JSZip.JSZipObject | null {
  const fullPath = gameRoot ? `${gameRoot}/${relativePath}` : relativePath;
  return zip.file(fullPath);
}

export function fileExistsInZip(zip: JSZip, relativePath: string, gameRoot: string): boolean {
  return findFileInZip(zip, relativePath, gameRoot) !== null;
}

/**
 * Locate cgs.json in a zip file.
 * Returns the JSZipObject and the game root path (empty string if at root).
 */
export function locateCgsJson(
  zip: JSZip,
): { cgsJsonFile: JSZip.JSZipObject; gameRoot: string } | null {
  // Try root level
  const rootFile = zip.file('cgs.json');
  if (rootFile) {
    return { cgsJsonFile: rootFile, gameRoot: '' };
  }

  // Check for a single top-level directory containing cgs.json
  const topLevelEntries = new Set<string>();
  zip.forEach((relativePath) => {
    const topLevel = relativePath.split('/')[0];
    topLevelEntries.add(topLevel);
  });

  if (topLevelEntries.size === 1) {
    const singleDir = [...topLevelEntries][0];
    const nestedFile = zip.file(`${singleDir}/cgs.json`);
    if (nestedFile) {
      return { cgsJsonFile: nestedFile, gameRoot: singleDir };
    }
  }

  return null;
}

/**
 * Validate that a parsed cgs.json object has the required fields.
 * Returns an error message or null if valid.
 */
export function validateCgsJson(parsed: unknown): string | null {
  if (typeof parsed !== 'object' || parsed === null) {
    return 'Invalid cgs.json: not valid JSON';
  }
  const obj = parsed as Record<string, unknown>;
  if (!obj.name || typeof obj.name !== 'string') {
    return "Invalid cgs.json: missing required 'name' field";
  }
  return null;
}

/**
 * Rewrite URL fields in cgs.json to point to Firebase Storage public URLs.
 */
export function rewriteCgsJsonUrls(
  cgsJson: CgsJson,
  storageBasePath: string,
  bucketName: string,
  username: string,
  slug: string,
  zip: JSZip,
  gameRoot: string,
): CgsJson {
  const baseUrl = (relativePath: string) =>
    getPublicUrl(bucketName, `${storageBasePath}/${relativePath}`);

  // autoUpdateUrl -> points to the stored cgs.json itself
  cgsJson.autoUpdateUrl = baseUrl('cgs.json');

  // cgsGamesLink -> points to the game page on cgs.games
  cgsJson.cgsGamesLink = `https://cgs.games/${username}/${slug}`;

  // bannerImageUrl
  const bannerExt = cgsJson.bannerImageFileType || 'png';
  const bannerFile = `Banner.${bannerExt}`;
  if (fileExistsInZip(zip, bannerFile, gameRoot)) {
    cgsJson.bannerImageUrl = baseUrl(bannerFile);
  }

  // cardBackImageUrl
  const cardBackExt = cgsJson.cardBackImageFileType || 'png';
  const cardBackFile = `CardBack.${cardBackExt}`;
  if (fileExistsInZip(zip, cardBackFile, gameRoot)) {
    cgsJson.cardBackImageUrl = baseUrl(cardBackFile);
  }

  // playMatImageUrl
  const playMatExt = cgsJson.playMatImageFileType || 'png';
  const playMatFile = `PlayMat.${playMatExt}`;
  if (fileExistsInZip(zip, playMatFile, gameRoot)) {
    cgsJson.playMatImageUrl = baseUrl(playMatFile);
  }

  // allCardsUrl
  if (fileExistsInZip(zip, 'AllCards.json', gameRoot)) {
    cgsJson.allCardsUrl = baseUrl('AllCards.json');
  }

  // allSetsUrl
  if (fileExistsInZip(zip, 'AllSets.json', gameRoot)) {
    cgsJson.allSetsUrl = baseUrl('AllSets.json');
  }

  // allDecksUrl
  if (fileExistsInZip(zip, 'AllDecks.json', gameRoot)) {
    cgsJson.allDecksUrl = baseUrl('AllDecks.json');
  }

  // cardImageUrl - construct template using Storage base URL
  // CGS uses template parameters like {cardSet} and {cardId} which must remain unencoded
  const cardImageExt = cgsJson.cardImageFileType || 'png';
  const setsFolder = gameRoot ? `${gameRoot}/sets` : 'sets';
  const hasSets = Object.keys(zip.files).some((f) => f.startsWith(setsFolder + '/'));
  if (hasSets) {
    const setsStoragePath = `${storageBasePath}/sets/`;
    const encodedSetsPath = encodeURIComponent(setsStoragePath);
    cgsJson.cardImageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedSetsPath}{cardSet}%2F{cardId}.${cardImageExt}?alt=media`;
  }

  // gameBoardUrls
  if (Array.isArray(cgsJson.gameBoardUrls)) {
    const boardExt = cgsJson.gameBoardImageFileType || 'png';
    cgsJson.gameBoardUrls = cgsJson.gameBoardUrls.map((board) => {
      if (board.id) {
        const boardFile = `boards/${board.id}.${boardExt}`;
        if (fileExistsInZip(zip, boardFile, gameRoot)) {
          return { ...board, url: baseUrl(boardFile) };
        }
      }
      return board;
    });
  }

  // deckUrls
  if (Array.isArray(cgsJson.deckUrls)) {
    const deckExt = cgsJson.deckFileType || 'txt';
    cgsJson.deckUrls = cgsJson.deckUrls.map((deck) => {
      if (deck.name) {
        const deckFile = `decks/${deck.name}.${deckExt}`;
        if (fileExistsInZip(zip, deckFile, gameRoot)) {
          return { ...deck, url: baseUrl(deckFile) };
        }
      }
      return deck;
    });
  }

  // cardBackFaceImageUrls
  if (Array.isArray(cgsJson.cardBackFaceImageUrls)) {
    const backExt = cgsJson.cardBackImageFileType || 'png';
    cgsJson.cardBackFaceImageUrls = cgsJson.cardBackFaceImageUrls.map((back) => {
      if (back.id) {
        const backFile = `backs/${back.id}.${backExt}`;
        if (fileExistsInZip(zip, backFile, gameRoot)) {
          return { ...back, url: baseUrl(backFile) };
        }
      }
      return back;
    });
  }

  return cgsJson;
}
