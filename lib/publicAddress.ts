import ipaddr from 'ipaddr.js';

/** Accepts only globally routed addresses, excluding local and transition networks. */
export function isPublicAddress(address: string): boolean {
  if (!ipaddr.isValid(address)) return false;
  const parsed = ipaddr.process(address);
  if (parsed.range() !== 'unicast') return false;
  // IPv6 destinations must also be in the currently allocated global unicast range.
  return parsed.kind() === 'ipv4' || parsed.match(ipaddr.parse('2000::'), 3);
}

// Names that resolve only inside a local network, never on the public internet.
const LOCAL_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home', '.home.arpa'];

/**
 * Whether the browser may load an image URL directly when the proxy can't fetch it. Applies the
 * proxy's own URL rules (public HTTPS on port 443, no credentials) to what the URL itself shows,
 * so a published banner can't make visitors' browsers send requests into their local networks.
 * The browser checks names that resolve to private addresses and redirects (Local Network Access).
 */
export function canLoadImageDirectly(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
  const hostname = url.hostname
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
    .toLowerCase();
  if (ipaddr.isValid(hostname)) return isPublicAddress(hostname);
  return (
    hostname.includes('.') &&
    hostname !== 'localhost' &&
    !LOCAL_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  );
}
