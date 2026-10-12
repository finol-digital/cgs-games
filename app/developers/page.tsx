import Link from 'next/link';
import InformationPage from '@/components/informationPage';
import { publicPageMetadata } from '@/lib/siteIdentity';

export const metadata = publicPageMetadata(
  'CGS Games Developers | API Documentation, CLI & Sandbox',
  'Integrate the Card Game Simulator community catalog with CGS Games API documentation, Firebase authentication, a read-only sandbox, and the official CLI.',
  '/developers',
);

export default function DevelopersPage() {
  return (
    <InformationPage title="CGS Games developer portal">
      <p>
        Use the CGS Games API to discover community Card Game Simulator games, retrieve cached Grand
        Archive spoiler cards, or publish and manage games for an authenticated creator. The{' '}
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
        401. Only the owner can delete a game. Spoiler cache maintenance uses a separate operator
        secret and is not part of normal agent use.
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
          <code>POST /api/games/upload</code>: upload a multipart <code>file</code> (.cgs.zip, at
          most 100 MiB), or submit a JSON stagedPath and originalFilename from an authenticated
          Firebase Storage upload. See the specification for allowed paths and cleanup behavior.
        </li>
        <li>
          <code>DELETE /api/games/&#123;id&#125;</code>: delete an owned game using its catalog
          document ID, not its slug. Success is plain text.
        </li>
        <li>
          <code>GET /api/gatcg_spoilers</code>: cached spoiler JSON in a data array. OCR text may be
          incomplete; observe X-Ocr-Pending and X-Cache.
        </li>
        <li>
          <code>GET /api/proxy/&#123;url&#125;</code> and{' '}
          <code>POST /api/proxy/&#123;url&#125;</code>: existing HTTPS resource passthrough.
          Responses depend on the upstream resource and may be binary. Prefer the typed catalog
          endpoints for function calls.
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
        Normal spoiler requests are limited to 10 per 60 seconds per client IP per running server
        instance. Catalog reads have no configured application quota. Spoiler responses use the{' '}
        <a href="https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/">
          IETF RateLimit draft
        </a>{' '}
        fields shown below. This is an Internet-Draft, not a finalized RFC. The legacy X-RateLimit
        headers remain available. Quotas are hints, not a service guarantee.
      </p>
      <pre>
        <code>{'RateLimit-Policy: "spoilers";q=10;w=60\nRateLimit: "spoilers";r=9;t=60'}</code>
      </pre>
      <p>
        The r value is the remaining request count; t is seconds until reset. A 429 includes
        Retry-After in seconds: wait at least that long, then use bounded retries with backoff.
        Per-client quota responses are not shared-cacheable; the underlying spoiler data remains
        cached in Firestore. Authorized operator warm requests are exempt. CORS exposes version,
        rate-limit, cache, and retry headers for browser clients.
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
cgs-games games --sandbox
cgs-games spoilers
cgs-games openapi`}</code>
      </pre>
      <p>
        The CLI supports public reads only, sends API-Version: 1, and exits unsuccessfully on an
        HTTP or network error. It reports Retry-After on 429 without automatically retrying. Use{' '}
        <code>--base-url http://localhost:3000</code> for local development. For support, visit{' '}
        <Link href="/contact">Contact CGS Games</Link>.
      </p>
    </InformationPage>
  );
}
