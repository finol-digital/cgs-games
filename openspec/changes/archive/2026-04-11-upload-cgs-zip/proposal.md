## Why

Users who create games in CGS's Developer Mode export a `.cgs.zip` file containing their full game data (cgs.json spec, card images, board images, decks, etc.). Currently, to share their game on cgs.games, they must first manually host all those files on a web server or GitHub, construct an AutoUpdateUrl pointing to their `cgs.json`, and then paste that URL into the upload form. This is a significant barrier for non-technical users who just want to share their game. By allowing direct `.cgs.zip` upload, we eliminate the need for external hosting entirely and make game sharing accessible to all CGS users.

## What Changes

- Add a `.cgs.zip` file upload option to the existing upload page alongside the current AutoUpdateUrl input
- Implement server-side zip extraction and validation: parse the `cgs.json` from the zip, validate it conforms to the CGS Card Game Specification (must have `name` at minimum)
- Store all extracted zip contents (cgs.json, AllCards.json, AllSets.json, AllDecks.json, images for banners/card backs/play mats/boards, card images in sets/ folders, deck files) in Firebase Storage under a user-scoped path
- Generate a public AutoUpdateUrl pointing to the stored `cgs.json` in Firebase Storage, and use that as the game's `autoUpdateUrl` and `cgsGamesUrl`
- Update the `cgs.json` stored in Firebase Storage to set `autoUpdateUrl` and `cgsGamesLink` to point back to the hosted files and the cgs.games page respectively
- Update Firebase Storage security rules to allow public read access for game content
- When a game uploaded via zip is deleted, also clean up its Firebase Storage files

## Capabilities

### New Capabilities

- `zip-upload`: Client-side `.cgs.zip` file selection, validation, and upload to the server via a new API endpoint
- `zip-processing`: Server-side zip extraction, CGS spec validation, Firebase Storage upload of all game assets, and AutoUpdateUrl generation
- `storage-cleanup`: Deletion of Firebase Storage game assets when a zip-uploaded game is removed

### Modified Capabilities

## Impact

- **UI**: `components/uploadGameForm.tsx` - new file input tab/toggle alongside existing URL input
- **API**: New `POST /api/games/upload` endpoint for multipart form data zip upload
- **API**: Modified `DELETE /api/games/[id]` to also delete Storage files for zip-uploaded games
- **Firebase Storage**: Currently unused; will be activated with new security rules allowing public reads for `games/` path
- **Firebase Storage Rules**: `storage.rules` must be updated from deny-all to allow public reads under `games/{userId}/`
- **Dependencies**: Need a server-side zip library (e.g., `jszip` or `adm-zip`) for extraction in the API route
- **Game Model**: May add an optional `storageBasePath` field to track zip-uploaded games for cleanup purposes
