## Context

CGS (Card Game Simulator) users create custom card games using Developer Mode, which produces a `.cgs.zip` file containing the full game folder structure: a `cgs.json` spec file, card/set data JSONs, and image assets (banner, card back, play mat, boards, card images organized by set). Currently, the cgs.games upload page only accepts an AutoUpdateUrl -- a URL pointing to an externally-hosted `cgs.json` file. This requires users to host their game files on GitHub or a web server before they can share on cgs.games.

The codebase already initializes Firebase Storage (`lib/firebase/firebase.ts`) but never uses it. Storage security rules deny all access. The existing upload flow is: user provides URL -> `POST /api/games` fetches the JSON -> extracts `name`, `bannerImageUrl`, `copyright` -> writes a Firestore document. No files are ever stored.

**Key constraint**: The CGS app downloads game data by fetching `cgs.json` from the `autoUpdateUrl`, then following URLs within that JSON (for cards, sets, images, etc.). For zip-uploaded games to work with the CGS app, the stored files must be publicly accessible and the `cgs.json` must have valid URLs pointing to the other stored assets.

## Goals / Non-Goals

**Goals:**

- Allow users to upload a `.cgs.zip` file directly from the upload page as an alternative to providing an AutoUpdateUrl
- Extract, validate, and store all zip contents in Firebase Storage
- Generate a publicly-accessible `autoUpdateUrl` from the stored `cgs.json`
- Rewrite URLs inside the stored `cgs.json` to point to the Firebase Storage-hosted assets
- Clean up Storage files when a zip-uploaded game is deleted
- Maintain full backward compatibility with the existing URL-based upload flow

**Non-Goals:**

- Editing or modifying game contents after upload (no in-browser editor)
- Validating card data beyond basic `cgs.json` structure (we trust the zip contents)
- Supporting incremental updates to zip-uploaded games (user re-uploads the full zip to update)
- Handling games larger than a reasonable upload limit (will cap at ~100MB)
- Migrating existing URL-based games to Storage

## Decisions

### 1. Storage path structure

**Decision**: Store zip contents at `games/{userId}/{gameSlug}/` in Firebase Storage, mirroring the CGS folder structure.

**Rationale**: User-scoped paths enable simple security rules. Using `gameSlug` (derived from the game name) keeps paths human-readable and matches the CGS convention. The folder structure inside mirrors the CGS game folder (`cgs.json`, `AllCards.json`, `sets/`, `boards/`, etc.).

**Alternatives considered**:

- Using the Firestore document ID as the path key: Less readable, harder to debug.
- Flat structure with hashed filenames: Breaks the natural CGS folder hierarchy, harder to serve as a coherent game.

### 2. URL rewriting in cgs.json

**Decision**: After extracting the zip, rewrite URL fields in `cgs.json` (`bannerImageUrl`, `cardBackImageUrl`, `playMatImageUrl`, `allCardsUrl`, `allSetsUrl`, `allDecksUrl`, `autoUpdateUrl`, `cgsGamesLink`, and board/deck URLs) to point to their Firebase Storage public URLs, then upload the modified `cgs.json`.

**Rationale**: The CGS app fetches resources by following URLs in `cgs.json`. Since the zip's internal `cgs.json` may have relative paths, local paths, or no URLs at all (games created in Developer Mode often have empty URL fields), we must set these to the actual Storage URLs. For image URLs referenced by `cardImageUrl` template, we construct the correct template using the Storage base URL.

**Alternatives considered**:

- Serving through the existing `/api/proxy/` route: Adds unnecessary latency and server load. Direct Firebase Storage URLs are faster and more scalable.
- Not rewriting URLs (relying on relative paths): Firebase Storage doesn't support relative path resolution.

### 3. API endpoint design

**Decision**: Create a new `POST /api/games/upload` endpoint that accepts `multipart/form-data` with the zip file, rather than extending the existing `POST /api/games`.

**Rationale**: The existing endpoint accepts a JSON body with `{ autoUpdateUrl }`. Multipart form data is fundamentally different and mixing the two in one endpoint adds complexity. A separate endpoint keeps concerns clean and is easier to test, document, and rate-limit independently.

**Alternatives considered**:

- Extending `POST /api/games` with content-type detection: Muddies the API contract, harder to maintain.
- Client-side extraction with direct Storage uploads: Would require giving authenticated users write access to Storage from the client, increasing attack surface. Server-side processing is more secure and allows validation.

### 4. Zip processing library

**Decision**: Use `jszip` for server-side zip extraction.

**Rationale**: `jszip` is a well-maintained, pure JavaScript library that works in Node.js without native dependencies. It handles in-memory extraction well and is already commonly used in the JS ecosystem. No native compilation issues on Firebase App Hosting.

**Alternatives considered**:

- `adm-zip`: Also viable but has had more edge-case bugs historically.
- `yauzl`: Lower-level, streaming API. More efficient for very large files but more complex to use.

### 5. Firebase Storage security rules

**Decision**: Allow public read access under `games/{userId}/{gameSlug}/` and restrict writes to authenticated server-side (Admin SDK) only.

**Rationale**: Game assets must be publicly readable so the CGS app (and cgs.games proxy) can fetch them. All writes go through the Admin SDK (server-side API route), so client write rules remain denied. This is the simplest secure configuration.

### 6. Tracking zip-uploaded games for cleanup

**Decision**: Add an optional `storageBasePath` field to the game Firestore document. When present, it indicates the game was uploaded via zip and its Storage files live at that path.

**Rationale**: Simple, minimal schema change. The `DELETE /api/games/[id]` handler checks for `storageBasePath` and, if present, recursively deletes all files under that path in Storage. URL-based games have no `storageBasePath` and are unaffected.

### 7. Upload size limit

**Decision**: Limit zip uploads to 100MB via the API route.

**Rationale**: Game zips with card images can be substantial but 100MB is generous. Next.js body size limits must be configured explicitly. This prevents abuse while accommodating most games.

## Risks / Trade-offs

- **[Firebase Storage costs]** -> Storing user-uploaded game assets will incur Storage and bandwidth costs. Mitigation: Start with reasonable per-user limits and monitor usage. The current user base is small.
- **[Large zip processing time]** -> Extracting and uploading many files from a large zip could take significant time. Mitigation: Process files with concurrent uploads (batch parallel uploads to Storage), show progress indication on the client side.
- **[Zip contents trust]** -> We accept arbitrary files from the zip. Mitigation: Only process known file extensions (json, png, jpg, jpeg, gif, webp, txt, dec, hsd, ydk, lor). Skip unknown files. Validate that `cgs.json` exists and parses as valid JSON with a `name` field.
- **[URL rewriting completeness]** -> The CGS spec has many URL fields, some nested in arrays. Mitigation: Handle all known URL fields from the schema. For `cardImageUrl` templates that reference `{cardSet}` and `{cardId}`, construct the template using the Storage base path.
- **[Next.js body parser limits]** -> Default body size limits may reject large uploads. Mitigation: Configure `api.bodyParser` in the route config to handle up to 100MB, or use streaming with `formidable`/`busboy`.
