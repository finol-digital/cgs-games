### Requirement: API endpoint accepts zip upload

The system SHALL expose a `POST /api/games/upload` endpoint that accepts `multipart/form-data` containing a `.cgs.zip` file. The endpoint SHALL require a valid Firebase ID token in the `Authorization: Bearer` header.

#### Scenario: Authenticated user uploads valid zip

- **WHEN** an authenticated user POSTs a valid `.cgs.zip` file to `/api/games/upload`
- **THEN** the server SHALL process the zip and return `{ success: true, slug }` with HTTP 200

#### Scenario: Unauthenticated request

- **WHEN** a request is made without a valid Authorization header
- **THEN** the server SHALL return HTTP 401 with an error message

#### Scenario: Request exceeds size limit

- **WHEN** the uploaded file exceeds 100MB
- **THEN** the server SHALL return HTTP 413 with an error message

### Requirement: Zip extraction and cgs.json validation

The server SHALL extract the zip contents in memory and locate the `cgs.json` file. The `cgs.json` MUST exist at the root level of the zip (or inside a single top-level directory). The `cgs.json` MUST parse as valid JSON and MUST contain a `name` field.

#### Scenario: Valid zip with cgs.json at root

- **WHEN** the zip contains `cgs.json` at the root level
- **THEN** the server SHALL parse it and proceed with processing

#### Scenario: Valid zip with cgs.json inside a single top-level directory

- **WHEN** the zip contains a single top-level directory that contains `cgs.json`
- **THEN** the server SHALL treat that directory as the game root and proceed

#### Scenario: Zip missing cgs.json

- **WHEN** the zip does not contain a `cgs.json` file
- **THEN** the server SHALL return HTTP 400 with error "Invalid .cgs.zip: missing cgs.json"

#### Scenario: cgs.json missing name field

- **WHEN** the `cgs.json` parses as JSON but lacks a `name` field
- **THEN** the server SHALL return HTTP 400 with error "Invalid cgs.json: missing required 'name' field"

#### Scenario: cgs.json is invalid JSON

- **WHEN** the `cgs.json` file cannot be parsed as JSON
- **THEN** the server SHALL return HTTP 400 with error "Invalid cgs.json: not valid JSON"

### Requirement: File filtering during extraction

The server SHALL only process files with known safe extensions during extraction. Unknown file types SHALL be skipped.

#### Scenario: Known file types are processed

- **WHEN** the zip contains files with extensions `.json`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.txt`, `.dec`, `.hsd`, `.ydk`, `.lor`
- **THEN** the server SHALL upload those files to Firebase Storage

#### Scenario: Unknown file types are skipped

- **WHEN** the zip contains files with unrecognized extensions (e.g., `.exe`, `.dll`)
- **THEN** the server SHALL skip those files without error

### Requirement: Upload extracted files to Firebase Storage

The server SHALL upload all valid extracted files to Firebase Storage at the path `games/{userId}/{gameSlug}/`, preserving the CGS folder structure (e.g., `sets/`, `boards/`, `decks/`, `backs/`).

#### Scenario: Files stored with correct structure

- **WHEN** the zip contains `cgs.json`, `Banner.png`, `sets/StarterSet/card1.png`
- **THEN** Storage SHALL contain `games/{userId}/{gameSlug}/cgs.json`, `games/{userId}/{gameSlug}/Banner.png`, `games/{userId}/{gameSlug}/sets/StarterSet/card1.png`

#### Scenario: Files are publicly accessible

- **WHEN** files are uploaded to Firebase Storage
- **THEN** each file SHALL be accessible via its public download URL without authentication

### Requirement: URL rewriting in cgs.json

Before uploading `cgs.json` to Storage, the server SHALL rewrite URL fields to point to the Firebase Storage public URLs for the corresponding files. The fields to rewrite include: `autoUpdateUrl`, `bannerImageUrl`, `cardBackImageUrl`, `playMatImageUrl`, `allCardsUrl`, `allSetsUrl`, `allDecksUrl`, and URL fields within arrays (`gameBoardUrls`, `deckUrls`, `cardBackFaceImageUrls`). The `cardImageUrl` template SHALL be rewritten using the Storage base URL with the original template parameters preserved. The `cgsGamesLink` SHALL be set to the cgs.games page URL for this game.

#### Scenario: Banner image URL rewritten

- **WHEN** the zip contains `Banner.png` and `cgs.json` has any `bannerImageUrl` value
- **THEN** the stored `cgs.json` SHALL have `bannerImageUrl` set to the Firebase Storage public URL for `Banner.png`

#### Scenario: autoUpdateUrl set to stored cgs.json

- **WHEN** `cgs.json` is uploaded to Storage
- **THEN** the stored `cgs.json` SHALL have `autoUpdateUrl` set to its own Firebase Storage public URL

#### Scenario: cgsGamesLink set to game page

- **WHEN** a game is created with username `alice` and slug `my_game`
- **THEN** the stored `cgs.json` SHALL have `cgsGamesLink` set to `https://cgs.games/alice/my_game`

#### Scenario: cardImageUrl template rewritten

- **WHEN** the zip contains card images under `sets/` directories
- **THEN** the stored `cgs.json` SHALL have `cardImageUrl` set to a template using the Storage base URL with `{cardSet}` and `{cardId}` parameters

### Requirement: Firestore game document creation

After successfully uploading all files to Storage, the server SHALL create a Firestore document in the `games` collection with the same fields as the existing URL-based flow (`username`, `slug`, `name`, `bannerImageUrl`, `autoUpdateUrl`, `copyright`, `uploadedAt`) plus an additional `storageBasePath` field containing the Storage path prefix.

#### Scenario: Game document includes storageBasePath

- **WHEN** a zip-uploaded game is successfully processed
- **THEN** the Firestore document SHALL include `storageBasePath` set to `games/{userId}/{gameSlug}`

#### Scenario: bannerImageUrl uses Storage URL

- **WHEN** the zip contains a banner image
- **THEN** the Firestore game document `bannerImageUrl` SHALL be the Firebase Storage public URL for that image

#### Scenario: Duplicate game name handling

- **WHEN** the user already has a game with the same slug
- **THEN** the server SHALL return HTTP 409 with an error indicating a game with that name already exists

### Requirement: Firebase Storage security rules

Firebase Storage rules SHALL allow public read access for files under the `games/` path. Client-side writes SHALL remain denied. All writes SHALL go through the Admin SDK on the server.

#### Scenario: Public can read game assets

- **WHEN** any client requests a file under `games/{userId}/{gameSlug}/`
- **THEN** Firebase Storage SHALL allow the read

#### Scenario: Client cannot write to Storage

- **WHEN** a client attempts to write to any Storage path
- **THEN** Firebase Storage SHALL deny the write
