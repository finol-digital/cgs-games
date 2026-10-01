import { NextResponse } from 'next/server';

const errors: Record<number, [string, string]> = {
  400: ['INVALID_REQUEST', 'Correct the request fields using /openapi.json and try again.'],
  401: ['UNAUTHORIZED', 'Provide a valid Bearer token for this endpoint. See /openapi.json.'],
  403: ['FORBIDDEN', 'Sign in as the owner of this resource.'],
  404: ['NOT_FOUND', 'Check the URL and consult /openapi.json or /sitemap.xml.'],
  405: ['METHOD_NOT_ALLOWED', 'Use a method listed in the Allow header and /openapi.json.'],
  409: ['CONFLICT', 'Choose another game name or remove your existing game first.'],
  413: ['PAYLOAD_TOO_LARGE', 'Upload a .cgs.zip file no larger than 100 MiB.'],
  429: ['RATE_LIMITED', 'Wait for the Retry-After interval before trying again.'],
  500: ['INTERNAL_ERROR', 'Try again later. Contact the site operator if the problem persists.'],
  502: ['UPSTREAM_ERROR', 'Check the upstream resource or try again later.'],
  503: ['SERVICE_UNAVAILABLE', 'Try again later; the resource could not be checked.'],
};

/** Keep the legacy error string for existing clients, with stable machine-readable fields. */
export function apiError(
  message: string,
  status: number,
  headers?: Record<string, string>,
  details?: { code: string; hint: string },
) {
  const [code, hint] = errors[status] ?? errors[500];
  return NextResponse.json(
    { error: message, code: details?.code ?? code, message, hint: details?.hint ?? hint },
    {
      status,
      headers: { 'Cache-Control': 'no-store', ...Object.fromEntries(new Headers(headers)) },
    },
  );
}

/** RFC 9110: the most specific matching media range determines each representation's quality. */
export function negotiatePage(accept: string | null): 'html' | 'markdown' | null {
  const ranges = (accept || '*/*').split(',').map((entry) => {
    const [type, ...parameters] = entry.trim().toLowerCase().split(';');
    const quality = parameters.find((parameter) => parameter.trim().startsWith('q='));
    const value = quality ? quality.trim().slice(2) : '1';
    const q = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(value) ? Number(value) : 0;
    return { type: type.trim(), q };
  });
  /** Resolves quality using the most specific media range that matches the representation. */
  function qualityFor(type: string) {
    for (const match of [type, 'text/*', '*/*']) {
      const matches = ranges.filter((range) => range.type === match);
      if (matches.length) return Math.max(...matches.map((range) => range.q));
    }
    return 0;
  }
  const html = qualityFor('text/html');
  const markdown = qualityFor('text/markdown');
  if (!html && !markdown) return null;
  // Prefer HTML on ties so browser requests and wildcards preserve the normal UI.
  return markdown > html ? 'markdown' : 'html';
}

/** Returns uncached UTF-8 Markdown with the negotiation header and requested status. */
export function markdownResponse(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      Vary: 'Accept',
      'Cache-Control': 'no-store',
    },
  });
}

export const notFoundMarkdown = `# 404 - Not Found

The requested page or resource does not exist on CGS Games. Check the URL before trying again.

- [CGS Games](https://cgs.games/)
- [Agent guide](https://cgs.games/llms.txt)
- [API specification](https://cgs.games/openapi.json)
- [Sitemap](https://cgs.games/sitemap.xml)
`;
