# CGS Games

Website for Card Game Simulator (CGS) users to share their games.

Built with Next.js and Firebase.

## Local Setup

Requires Node.js 24.12.0 or newer for the Firebase SDK and rules testing tools.

**First**: `npm install`

**Audit**: `npm audit` (CI requires zero reported vulnerabilities)

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

### Username routes and Firestore rules

New creator names must satisfy `lib/username.ts` and the matching Firestore creation
rules. Application route prefixes and public assets are reserved in
`lib/reservedUsernames.json`; tests require the Firestore list to match and detect
new routes missing from the list. Existing accounts are not renamed by this policy.

Run the database enforcement tests with Java 21 installed:

```sh
npx --yes firebase-tools@15.33.0 emulators:exec --config firebase.rules-test.json --only firestore,storage --project demo-cgs-username-tests "npm run test:rules"
```

The tests use an isolated demo project and reject non-loopback emulator addresses.
CI runs them separately from Jest. Before adding reserved names, run
`npm run check:usernames` with the existing Firebase Admin environment configured.
It only reads public username fields/registry names and reports collisions without
user IDs. Resolve any existing-name collision before rolling out the new route.

App Hosting deploys the web application; the updated database rules also need an
authorized `firebase deploy --only firestore:rules,storage --project cgs-games`. Deploy
those rules as part of rollout so direct clients cannot bypass form validation.

### Firebase ownership boundaries

Clients can read the public game catalog and published assets, but only the
authenticated server APIs can publish or delete games. These APIs reject revoked
tokens, require the immutable username registry to agree with the user's profile,
and bind new games to the verified Firebase UID. Legacy games remain supported
through the verified registry. Storage cleanup accepts only the exact
`games/{uid}/{slug}/` prefix derived from that owner and game.

Profiles are private to their owner. Registration atomically creates a minimal
profile and its matching registry entry; neither ownership mapping can be changed
by a client. Username availability checks remain public single-document reads.
Internal caches, unknown collections, and nested namespaces are server-only.
Users can create, replace, and delete their own staged ZIPs; all published asset
writes go through the server. Firebase Admin and project IAM principals bypass
these client rules and must retain only the permissions their workloads need.

Run `npm run audit:firebase` with the existing Admin environment for a read-only
ownership inventory. It checks profiles, registry mappings, game owners, storage
prefixes, account existence, object permissions, and deployed rules. Reports can
contain account identifiers and are saved under ignored `.firebase/security-audit/`.
An unavailable IAM/control-plane check is reported as a limitation, not a pass;
complete those checks with an appropriately authorized operator account.

The legacy Firebase Hosting site is redirect-only. `firebase deploy --only hosting`
updates redirects to `https://cgs.games`; it does not deploy Next.js. Keep the
retired `ssrcgsgames` backend out of Hosting configuration. Firebase's reserved
`/__/auth/` helpers remain available for Google sign-in.

## Dependency Security

A direct local `fast-glob` dependency supplies `@next/eslint-plugin-next@16.4.0`
with the small adapter in `packages/next-root-glob`.
It delegates the plugin's only glob call, `globSync`, to the published
[`tinyglobby`](https://superchupu.dev/tinyglobby) package and disables automatic
directory expansion to preserve literal project roots. It contains no forked
library code and is not a general-purpose replacement for all of `fast-glob`.
The adapter has its own package name, `@cgs-games/next-root-glob`; its version
`3.3.1` satisfies the plugin's exact dependency requirement so npm can deduplicate
it. `.npmrc` enables `install-links` so fresh installs package the local source
instead of creating directory links. Keep that setting in CI and deployment.

The application uses the default project root. Tests also cover literal roots,
multiple roots, directory wildcards, and brace alternatives. Advanced root patterns
such as zero-padded or stepped brace ranges are not supported by tinyglobby; see
its [syntax differences](https://superchupu.dev/tinyglobby/comparison).
Review the adapter when upgrading the Next.js ESLint plugin, and
remove it once upstream drops the vulnerable dependency chain. Run
`npm test -- --runInBand __tests__/lintDependencies.test.js` to verify root discovery,
lint enforcement, and the absence of the removed packages from the lockfile.

CI runs `npm audit` without exclusions or severity filtering. Keep the full audit
clean rather than suppressing advisories or using `npm audit fix --force` to
downgrade the toolchain.
