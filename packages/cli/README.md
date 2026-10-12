# CGS Games CLI

Official command line client for the [CGS Games API](https://cgs.games/developers).
Requires Node.js 22 or later. No runtime dependencies. Public reads need no credentials.

```sh
npm install --global https://cgs.games/downloads/cgs-games-cli-1.0.0.tgz
cgs-games games
cgs-games browse
cgs-games games --sandbox
cgs-games browse --sandbox
cgs-games openapi
cgs-games games --base-url http://localhost:3000
```

`browse` is an alias for `games` and accepts the same options, including `--sandbox`.

## Sign in and upload

```sh
cgs-games auth login
cgs-games auth status
cgs-games upload --file ./my-game.cgs.zip --dry-run
cgs-games upload --file ./my-game.cgs.zip
cgs-games upload --url https://example.com/my-game/cgs.json
cgs-games auth logout
```

`auth login` opens Google sign-in on the CGS Games website. Explicitly authorize
the CLI you started; the browser posts an ID token to a random IPv4 loopback port.
The CLI verifies the token with the selected site before saving it. Use
`--no-browser` to open the printed link yourself on the same computer.
Authentication expires within one hour; repeat login when needed. Google passwords
and refresh tokens are never sent to the CLI. Choose a creator username on the
website's Upload page before publishing.

For scripts, supply a Firebase ID token with `CGS_TOKEN`, or pipe one into
`cgs-games auth login --token-stdin`. Do not put tokens in command arguments or
source control. `CGS_TOKEN` takes precedence and is not saved. Saved credentials
are separated by exact origin in `~/.cgs-games` (override with `CGS_CONFIG_DIR`),
with owner-only file permissions on POSIX. Keep that directory private on Windows.
`auth logout` removes the selected origin's saved token; it does not clear your
environment variable or revoke browser sessions. Reads never send credentials.

Upload commands publish real listings under your creator account. `--dry-run`
checks arguments, file extension and size without authentication or network
requests; it does not validate ZIP contents or server permissions. Archives must
be nonempty `.cgs.zip` files up to 100 MiB. They are staged directly in Firebase
Storage under your account, then processed by the existing upload API. Each
attempt uses a unique staged object and attempts cleanup afterward. A failure or
timeout is never automatically retried: check your creator page before retrying
because publication might have completed even if the response was lost.

Commands print JSON to stdout. Failures exit with status 1 and write to stderr.
API requests select version 1. Reads/session checks time out after 30 seconds;
uploads and browser login allow five minutes. A 429 reports
Retry-After without retrying automatically. The sandbox serves example data,
not playable listings, and accepts no writes. Use `--base-url` consistently on
auth and upload commands for local development. Redirects are never followed.
Deleting published games remains a website/API operation.

Registry publication is pending. The versioned site download is installable with npm.
Maintainers: run `npm run pack:cli` from the repository root after modifying the
package. Bump the package version and download links for a new release; do not
replace a published version. Publishing to npm additionally requires package-name
availability, an authorized npm account, and the account's authentication/2FA.
