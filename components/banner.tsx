'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { directImageFallback, proxyImagePath } from '@/lib/imageFallback';
import { cn } from '@/lib/utils';

interface BannerProps {
  home?: string;
  img?: string;
  txt?: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
}

/**
 * Renders a responsive banner, proxying HTTPS sources and prioritizing visible content on request.
 * Some hosts block cgs.games' servers (e.g. bot challenges for data-center IPs), so a proxied image
 * that fails to load may fall back to the original URL, fetched directly by the visitor's browser.
 */
export default function Banner({
  home = '/',
  img = '/Card-Game-Simulator.png',
  txt = 'Card Game Simulator',
  priority = false,
  sizes = '100vw',
  className,
}: BannerProps) {
  const imgDefault = img?.trim() || '/Card-Game-Simulator.png';
  // Matches the upload API's URL parsing, including mixed-case schemes and whitespace. Local
  // public assets are relative paths and do not need the HTTPS proxy.
  const proxyPath = proxyImagePath(imgDefault);
  const imgPath = proxyPath ?? imgDefault;
  // The same normalized URL the proxy path names, so the proxy checks exactly what may load.
  const directUrl = proxyPath && 'https://' + proxyPath.slice('/api/proxy/'.length);
  // Every image change retries the proxy first, even returning to a URL that failed before.
  const [fallback, setFallback] = useState({ source: directUrl, direct: false });
  if (fallback.source !== directUrl) setFallback({ source: directUrl, direct: false });
  const direct = directUrl !== null && fallback.source === directUrl && fallback.direct;
  const bannerImage = (
    <Image
      className="object-contain rounded"
      src={direct ? directUrl! : imgPath}
      alt={txt}
      fill
      sizes={sizes}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      // The fallback bypasses the optimizer, whose remote patterns only allow the proxy.
      unoptimized={direct}
      referrerPolicy={direct ? 'no-referrer' : undefined}
      onError={
        directUrl && !direct
          ? () => {
              void directImageFallback(directUrl).then((checked) => {
                // A check that finishes after the image changed must not touch the new image.
                if (checked === directUrl) {
                  setFallback((current) =>
                    current.source === directUrl ? { ...current, direct: true } : current,
                  );
                }
              });
            }
          : undefined
      }
    />
  );

  return (
    <div
      className={cn(
        'border-none bg-slate-800 flex justify-center items-center w-full h-32',
        className,
      )}
    >
      {home.startsWith('https://') ? (
        <a
          href={home}
          className="relative flex justify-center items-center w-full h-full rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d3bd7a]"
          target="_blank"
          rel="noopener noreferrer"
        >
          {bannerImage}
        </a>
      ) : (
        <Link
          href={home}
          className="relative flex justify-center items-center w-full h-full rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d3bd7a]"
        >
          {bannerImage}
        </Link>
      )}
    </div>
  );
}
