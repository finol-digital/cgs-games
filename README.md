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

## Agent access and verification

The homepage supports `Accept: text/markdown` and `Accept: text/html`, including
quality values and a 406 response when neither format is acceptable. Markdown
responses include `Vary: Accept` and are not cached. The HTML homepage contains
server-rendered introductory content, even when the game collection is empty.

`/openapi.json` documents every API route; `/llms.txt` links to the catalog,
specification, sitemap, and site policies. API errors use
`{ error, code, message, hint }`, preserving the existing `error` string for clients.

The root `proxy.ts` checks creator/game existence before rendering, so missing
pages return HTTP 404 even when Next.js streams the layout. Markdown 404 responses
link to the agent guide. Empty registered creator profiles remain valid. Update
`lib/siteRoutes.ts` and the OpenAPI specification when adding routes; inventory
tests check for drift.

Run the HTTP checks against a production build:

```sh
npm run build
npm run start -- --port 3101
# In a second terminal:
npm run verify:agents -- http://localhost:3101
```

The verifier checks HTML/Markdown negotiation, 404s, machine-readable files,
public pages, every API route, and unauthenticated write rejection. It never
publishes or deletes a game. The normal spoiler GET can refresh its existing
cache. Firebase server credentials are required for data-backed routes. After
deployment, run `npm run verify:agents -- https://cgs.games` to check the hosting
layer too. Authenticated publishing/deletion is covered with mocked services in
Jest; live write checks should use a dedicated test account and game.

## Deployment

Firebase App Hosting will automatically deploy changes to the main branch.

Simply raise and merge a PR from develop to main!
