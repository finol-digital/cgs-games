# CGS Games

Website for Card Game Simulator (CGS) users to share their games.

Built with Next.js and Firebase.

## Local Setup

**First**: `npm install`

**Audit**: `npm audit fix`

**Format**: `npm run format`

**Lint**: `npm run lint`

**Test**: `npm run test`

**Build**: `npm run build`

**Start**: `npm run start`

**Emulate**: `firebase emulators:start`

## Uploads

`.cgs.zip` uploads support files up to 100 MB. The browser stages zip files directly in Firebase Storage under `staged-uploads/{uid}/...`, then the upload API processes the staged object and publishes game assets under `games/{uid}/{slug}/...`.

## Deployment

Firebase App Hosting will automatically deploy changes to the main branch.

Simply raise and merge a PR from develop to main!
