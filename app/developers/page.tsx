import Link from 'next/link';
import InformationPage from '@/components/informationPage';
import { publicPageMetadata } from '@/lib/siteIdentity';

export const metadata = publicPageMetadata(
  'CGS Games Developers | API Documentation, CLI & Sandbox',
  'Integrate the Card Game Simulator community catalog with CGS Games API documentation, Firebase authentication, a read-only sandbox, and the official CLI.',
  '/developers',
);

/** Documents public integration contracts, authentication, sandbox reads, and the CLI. */
export default function DevelopersPage() {
  return (
    <InformationPage title="CGS Games developer portal">
      <p>
        Use the CGS Games API to discover community Card Game Simulator games or publish and manage
        games for an authenticated creator. The{' '}
        <Link href="/openapi.json">OpenAPI 3.1 specification</Link> describes every endpoint, input,
        response, and operation ID. Agents should also read <Link href="/llms.txt">llms.txt</Link>.
      </p>
      <h2 id="quickstart">Quickstart: read the game catalog</h2>
      <p>
        Public reads need no account or API key. Request version 1 explicitly; the response is a
        JSON array of up to 100 games, newest first. There are no API pagination or search
        parameters. Filter the returned array locally and link players to
        /&#123;username&#125;/&#123;slug&#125;.
      </p>
      <pre>
        <code>{'curl -H "API-Version: 1" https://cgs.games/api/games'}</code>
      </pre>
      <h2 id="authentication">Authentication and API keys</h2>
      <p>
        CGS Games does not issue developer API keys. Publishing and deleting require a Firebase
        Authentication ID token from a signed-in user with a creator username. Sign in on the{' '}
        <Link href="/upload" prefetch={false}>
          Upload page
        </Link>{' '}
        to set up your creator profile. In a Firebase client signed into the same project, obtain a
        fresh token with <code>await auth.currentUser.getIdToken()</code> and send it as{' '}
        <code>Authorization: Bearer &lt;FIREBASE_ID_TOKEN&gt;</code>. A Firebase project API key is
        not a user credential. Never embed user tokens in public code or URLs.
      </p>
      <pre>
        <code>{String.raw`curl -X POST https://cgs.games/api/games \
  -H "API-Version: 1" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"autoUpdateUrl":"https://example.com/my-game/cgs.json"}'`}</code>
      </pre>
      <p>
        Replace the example URL with your public HTTPS game specification. This request publishes a
        real listing; use it only with the creator’s authorization. Expired or invalid tokens return
        401. Only the owner can delete a game.
      </p>
      <h2 id="endpoints">Endpoints</h2>
      <ul>
        <li>
          <code>GET /api/games</code>: public catalog; <code>GET /api/browse</code> is a compatible
          alias.
        </li>
        <li>
          <code>POST /api/games</code>: publish a game from an auto-update URL with a Firebase ID
          token.
        </li>
        <li>
          <code>POST /api/cli/session</code>: verify a Firebase ID token (including revocation) and
          return its expiry, creator profile and upload bucket. No tokens are issued.
        </li>
        <li>
          <code>POST /api/games/upload</code>: upload a multipart <code>file</code> (.cgs.zip, at
          most 100 MiB), or submit a JSON stagedPath and originalFilename from an authenticated
          Firebase Storage upload. Archives may expand to at most 256 MiB (no single file over 64
          MiB, at most 20000 entries). Each creator may publish up to 50 games and store up to 1 GiB
          of published files. See the specification for allowed paths and cleanup behavior.
        </li>
        <li>
          <code>DELETE /api/games/&#123;id&#125;</code>: delete an owned game using its catalog
          document ID, not its slug. Success is plain text.
        </li>
        <li>
          <code>GET /api/proxy/&#123;url&#125;</code> and{' '}
          <code>POST /api/proxy/&#123;url&#125;</code>: public HTTPS resource passthrough on port
          443. Private network targets and unsafe redirects are blocked; active content is
          sandboxed. Responses are limited to 100 MiB and 30 seconds, and POST bodies to 16 MiB.
          Responses stream as bytes arrive. If a limit or connection failure occurs after headers
          have been sent, the stream is aborted; discard partial content. Responses depend on the
          upstream resource and may be binary. Only images, JSON, plain text, CSV, and binary
          downloads are served; documents such as HTML, SVG, XML, and PDF are refused. Requests are
          limited to 600 per minute per client, shared with optimized images served through{' '}
          <code>/_next/image</code>. Prefer the typed catalog endpoints for function calls.
        </li>
        <li>
          <code>GET /api/sandbox/games</code>: deterministic example catalog, with no database
          access.
        </li>
      </ul>
      <p>
        GET endpoints support HEAD. OPTIONS advertises allowed methods and CORS permissions. Errors
        include error, code, message, and hint; unsupported methods return 405 with Allow. The proxy
        cannot guarantee an upstream response schema.
      </p>
      <h2 id="sandbox">Read-only sandbox</h2>
      <p>
        The <Link href="/api/sandbox/games">sandbox catalog</Link> returns a fixed sample matching
        the production Game schema. It does not read or write production data, requires no
        credentials, and supports GET and HEAD only. Its example URLs and creator are fixtures, not
        playable listings. It is suitable for testing parsing and UI integration; authenticated
        writes and uploads are not simulated.
      </p>
      <pre>
        <code>{'curl -H "API-Version: 1" https://cgs.games/api/sandbox/games'}</code>
      </pre>
      <h2 id="versioning">Versioning and deprecation policy</h2>
      <p>
        Send the <code>API-Version: 1</code> request header. Omitting it selects version 1 for
        existing clients. Responses identify the supported version in API-Version; unsupported
        requested versions return 400 with code UNSUPPORTED_API_VERSION. This header is documented
        as a parameter in OpenAPI. Additive optional fields may be introduced within a version;
        clients should ignore fields they do not recognize. Breaking request or response changes
        require a new major version.
      </p>
      <p>
        Before retiring a version, we will publish a migration guide here and provide at least 90
        days’ notice. Affected responses will carry a{' '}
        <a href="https://www.rfc-editor.org/rfc/rfc9745.html">Deprecation</a> structured date (an
        @-prefixed Unix timestamp), a{' '}
        <a href="https://www.rfc-editor.org/rfc/rfc8594.html">Sunset</a> HTTP date, and a Link with
        rel=&quot;deprecation&quot; to migration instructions. Version 1 has no scheduled
        retirement; no deprecation dates are currently emitted.
      </p>
      <h2 id="rate-limits">Rate limits and retries</h2>
      <p>
        Catalog reads have no configured application quota. Endpoints with quotas document them in
        the <Link href="/openapi.json">OpenAPI specification</Link> and use the{' '}
        <a href="https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/">
          IETF RateLimit draft
        </a>{' '}
        fields RateLimit-Policy and RateLimit. This is an Internet-Draft, not a finalized RFC. The
        legacy X-RateLimit headers remain available. Quotas are hints, not a service guarantee.
      </p>
      <p>
        The r value is the remaining request count; t is seconds until reset. A 429 includes
        Retry-After in seconds: wait at least that long, then use bounded retries with backoff.
        Per-client quota responses are not shared-cacheable. CORS exposes version, rate-limit,
        cache, and retry headers for browser clients.
      </p>
      <h2 id="cli">Official CGS Games CLI</h2>
      <p>
        The CLI requires Node.js 22 or newer and prints JSON to standard output. Install the{' '}
        <a href="/downloads/cgs-games-cli-1.0.0.tgz">versioned CLI package</a> directly from this
        site. npm registry publication is pending; the download does not depend on a registry
        package name.
      </p>
      <pre>
        <code>{`npm install --global https://cgs.games/downloads/cgs-games-cli-1.0.0.tgz
cgs-games games
cgs-games browse
cgs-games games --sandbox
cgs-games openapi
cgs-games auth login
cgs-games auth status
cgs-games upload --file ./my-game.cgs.zip --dry-run
cgs-games upload --file ./my-game.cgs.zip
cgs-games upload --url https://example.com/my-game/cgs.json
cgs-games auth logout`}</code>
      </pre>
      <p>
        The <code>browse</code> command is an alias for <code>games</code> and accepts the same
        options, including <code>--sandbox</code>. Browser login uses Google sign-in and an explicit
        approval page. The CLI saves an origin-specific Firebase ID token in ~/.cgs-games for up to
        one hour; sign in again after expiry. Use <code>auth login --no-browser</code> to open the
        printed link yourself, or <code>auth login --token-stdin</code> for token input. Scripts can
        supply <code>CGS_TOKEN</code> without saving it. Never pass tokens in command arguments.{' '}
        <code>auth logout</code> removes the saved credential, not environment tokens or browser
        sessions. Choose a creator username on the Upload page before publishing.
      </p>
      <p>
        Uploads create real listings using the existing API and Firebase Storage permissions.
        Archives must be nonempty .cgs.zip files up to 100 MiB. <code>--dry-run</code> checks local
        inputs without requests; it does not validate ZIP contents or server permissions. No writes
        are supported in the sandbox. API calls send API-Version: 1 and exit unsuccessfully on an
        HTTP or network error. Reads time out after 30 seconds; uploads allow five minutes. Check
        your creator page after a timeout before retrying a publication. The CLI reports Retry-After
        on 429 without automatically retrying. Use <code>--base-url http://localhost:3000</code> for
        local development. For support, visit <Link href="/contact">Contact CGS Games</Link>.
      </p>
    </InformationPage>
  );
}
