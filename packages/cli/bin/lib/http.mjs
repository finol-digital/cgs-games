/** Enforces explicit origins and keeps credentials out of redirect destinations. */
export function parseOrigin(value) {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error(
      '--base-url must be an HTTPS origin or a local loopback HTTP origin, without credentials.',
    );
  }
  return url;
}

/** Makes one bounded request, never replaying a write or including credentials in errors. */
export async function requestJson(
  url,
  { token, method = 'GET', body, headers = {}, timeout = 30000 } = {},
) {
  const response = await fetch(url, {
    method,
    body,
    redirect: 'error',
    signal: AbortSignal.timeout(timeout),
    headers: {
      Accept: 'application/json',
      'API-Version': '1',
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    const retry = response.headers.get('retry-after');
    const hint =
      response.status === 401
        ? ' Sign in again with auth login.'
        : response.status === 409
          ? ' Choose a different game name or manage the existing listing on the website.'
          : '';
    throw new Error(
      `HTTP ${response.status}${retry ? `; Retry-After: ${retry}` : ''}.${hint} See https://cgs.games/developers.`,
    );
  }
  return response.json();
}
