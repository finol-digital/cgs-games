## 1. Setup and Dependencies

- [x] 1.1 Install `jszip` package as a production dependency
- [x] 1.2 Update `lib/game.ts` Game interface to add optional `storageBasePath?: string` field

## 2. Firebase Storage Configuration

- [x] 2.1 Update `storage.rules` to allow public read access under `games/` path while keeping writes denied for clients
- [x] 2.2 Verify `lib/firebase/firebase.ts` exports the `storage` object (already initialized but unused) and confirm `lib/firebase/admin.ts` can access Storage via Admin SDK — add `getStorage` from `firebase-admin/storage` if not already present

## 3. Server-side Zip Processing API

- [x] 3.1 Create `app/api/games/upload/route.ts` with POST handler that: authenticates via Firebase ID token, reads multipart form data, and enforces 100MB size limit
- [x] 3.2 Implement zip extraction logic: use `jszip` to extract contents in memory, locate `cgs.json` (at root or inside single top-level directory), validate it parses as JSON with a `name` field
- [x] 3.3 Implement file filtering: only process files with known safe extensions (`.json`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.txt`, `.dec`, `.hsd`, `.ydk`, `.lor`)
- [x] 3.4 Implement Firebase Storage upload: upload all valid extracted files to `games/{userId}/{gameSlug}/` preserving the CGS folder structure, with appropriate content types
- [x] 3.5 Implement URL rewriting in `cgs.json`: rewrite `autoUpdateUrl`, `bannerImageUrl`, `cardBackImageUrl`, `playMatImageUrl`, `allCardsUrl`, `allSetsUrl`, `allDecksUrl`, URL fields in `gameBoardUrls`/`deckUrls`/`cardBackFaceImageUrls` arrays, `cardImageUrl` template, and set `cgsGamesLink` to the game page URL
- [x] 3.6 Implement Firestore game document creation: write to `games` collection with `username`, `slug`, `name`, `bannerImageUrl`, `autoUpdateUrl`, `copyright`, `uploadedAt`, and `storageBasePath`
- [x] 3.7 Add duplicate game detection: check if user already has a game with the same slug, return HTTP 409 if so

## 4. Storage Cleanup on Game Deletion

- [x] 4.1 Update `app/api/games/[id]/route.ts` DELETE handler to check for `storageBasePath` in the game document
- [x] 4.2 If `storageBasePath` is present, recursively list and delete all files under that path in Firebase Storage before deleting the Firestore document
- [x] 4.3 Handle Storage deletion failures gracefully: log errors but still delete the Firestore document and return success

## 5. Client-side Upload UI

- [x] 5.1 Add a toggle/tab component to `uploadGameForm.tsx` allowing the user to switch between "Enter AutoUpdate URL" and "Upload .cgs.zip File" modes
- [x] 5.2 Create the zip file input with `.cgs.zip` accept filter, client-side file extension validation, and 100MB size limit check
- [x] 5.3 Implement the zip upload submission: send the file as `multipart/form-data` to `POST /api/games/upload` with the Authorization header, show loading state during upload
- [x] 5.4 Handle success (navigate to game page) and error (display error message) responses

## 6. Update Upload Page Instructions

- [x] 6.1 Update `app/upload/page.tsx` instructional text to mention both upload options: direct `.cgs.zip` upload and AutoUpdate URL

## 7. Testing

- [x] 7.1 Write unit tests for zip extraction and `cgs.json` validation logic (valid zip, missing cgs.json, invalid JSON, missing name field)
- [x] 7.2 Write unit tests for URL rewriting logic (verify all URL fields are correctly rewritten)
- [x] 7.3 Write unit tests for file filtering (known extensions pass, unknown extensions are skipped)
- [x] 7.4 Verify the upload form renders both modes and toggles correctly
- [x] 7.5 Run `npm run lint` and `npm run build` to ensure no type errors or build failures
