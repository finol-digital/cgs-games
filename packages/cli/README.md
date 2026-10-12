# CGS Games CLI

Official read-only command line client for the [CGS Games API](https://cgs.games/developers).
Requires Node.js 22 or later. No runtime dependencies or credentials.

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

Commands print JSON to stdout. Failures exit with status 1 and write to stderr.
Requests select API version 1 and time out after 30 seconds. A 429 reports
Retry-After without retrying automatically. The sandbox serves example data,
not playable listings. Publishing and deletion are intentionally outside this CLI.

Registry publication is pending. The versioned site download is installable with npm.
Maintainers: run `npm run pack:cli` from the repository root after modifying the
package. Bump the package version and download links for a new release; do not
replace a published version. Publishing to npm additionally requires package-name
availability, an authorized npm account, and the account's authentication/2FA.
