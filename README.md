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

### Dependency security patches

`npm install` and `npm ci` apply the patches in `patches/` and fail if a patch cannot
be applied. Do not skip the postinstall step when validating or deploying dependencies.

As of October 8, 2026, `npm audit` reports seven high-severity findings, all from
the `braces` [stack-exhaustion advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
and its dependents. There is no patched upstream release. `patches/braces+3.0.3.patch`
backports the runtime guards from [upstream PR #72](https://github.com/micromatch/braces/pull/72)
at commit `28d440b5dd449dbf1fe6f3506cf94ecca4d02660` (closed, unmerged): parsing and AST
traversal are capped at 100 nesting levels, and cyclic expansion parent links are
rejected. Regression tests cover the guard and normal glob behavior.

The installed version remains 3.0.3, so npm still reports the advisory; this is a
local mitigation, not a clean audit. Remove the patch after upgrading to a verified
upstream fix. Avoid `npm audit fix --force`: its suggested major downgrades of
`eslint-config-next` and `patch-package` are incompatible with the current toolchain.

## Uploads

`.cgs.zip` uploads support files up to 100 MB. The browser stages zip files directly in Firebase Storage under `staged-uploads/{uid}/...`, then the upload API processes the staged object and publishes game assets under `games/{uid}/{slug}/...`.

## Deployment

Firebase App Hosting will automatically deploy changes to the main branch.

Simply raise and merge a PR from develop to main!
