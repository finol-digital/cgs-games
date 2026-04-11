## ADDED Requirements

### Requirement: Upload page offers zip file upload option

The upload page SHALL provide a file input that accepts `.cgs.zip` files as an alternative to the existing AutoUpdateUrl text input. The user SHALL be able to toggle between "Upload Zip" and "Enter URL" modes.

#### Scenario: User sees both upload options

- **WHEN** an authenticated user with a username visits the upload page
- **THEN** the form SHALL display a toggle or tab allowing the user to choose between "Upload .cgs.zip file" and "Enter AutoUpdate URL"

#### Scenario: Default mode is URL input

- **WHEN** the upload form loads
- **THEN** the AutoUpdate URL input SHALL be shown by default, preserving the existing behavior

### Requirement: Zip file input validates file selection

The file input SHALL only accept files with the `.cgs.zip` extension. The client SHALL validate that a file is selected before allowing submission.

#### Scenario: User selects a valid .cgs.zip file

- **WHEN** the user selects a file with `.cgs.zip` extension
- **THEN** the form SHALL display the filename and enable the upload button

#### Scenario: User selects an invalid file type

- **WHEN** the user selects a file that does not have `.cgs.zip` extension
- **THEN** the form SHALL display an error message indicating only `.cgs.zip` files are accepted

#### Scenario: File size exceeds limit

- **WHEN** the user selects a `.cgs.zip` file larger than 100MB
- **THEN** the form SHALL display an error message indicating the file exceeds the maximum allowed size

### Requirement: Zip upload sends file to server

The client SHALL send the selected `.cgs.zip` file to `POST /api/games/upload` as multipart form data with the user's Firebase ID token in the Authorization header.

#### Scenario: Successful upload submission

- **WHEN** the user clicks the upload button with a valid `.cgs.zip` selected
- **THEN** the client SHALL POST the file as `multipart/form-data` to `/api/games/upload` with `Authorization: Bearer <idToken>`
- **AND** the client SHALL display a loading indicator during upload

#### Scenario: Upload succeeds

- **WHEN** the server responds with `{ success: true, slug }`
- **THEN** the client SHALL navigate to `/{username}/{slug}`

#### Scenario: Upload fails

- **WHEN** the server responds with an error
- **THEN** the client SHALL display the error message to the user and re-enable the form

### Requirement: Upload progress feedback

The client SHALL provide visual feedback during the zip upload process since file uploads may take significant time.

#### Scenario: Large file upload in progress

- **WHEN** a zip file upload is in progress
- **THEN** the client SHALL display a loading state indicating the upload is being processed
