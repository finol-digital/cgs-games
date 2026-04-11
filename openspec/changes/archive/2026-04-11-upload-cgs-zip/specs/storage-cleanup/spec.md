## ADDED Requirements

### Requirement: Delete Storage files when zip-uploaded game is removed

When a game that was uploaded via zip (identified by having a `storageBasePath` in its Firestore document) is deleted, the server SHALL delete all files under that `storageBasePath` in Firebase Storage.

#### Scenario: Deleting a zip-uploaded game cleans up Storage

- **WHEN** an authenticated user deletes a game that has `storageBasePath` set
- **THEN** the server SHALL delete all files under `storageBasePath` in Firebase Storage
- **AND** the server SHALL delete the Firestore document

#### Scenario: Deleting a URL-based game does not touch Storage

- **WHEN** an authenticated user deletes a game that does NOT have `storageBasePath` set
- **THEN** the server SHALL only delete the Firestore document (no Storage operations)

#### Scenario: Storage deletion failure does not block game deletion

- **WHEN** Storage file deletion fails (e.g., files already removed)
- **THEN** the server SHALL still delete the Firestore document and return success
- **AND** the server SHALL log the Storage deletion error
