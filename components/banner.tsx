import Link from 'next/link';
import Image from 'next/image';

interface BannerProps {
  home?: string;
  img?: string;
  txt?: string;
  priority?: boolean;
  sizes?: string;
}

/** Renders a responsive banner, proxying HTTPS sources and prioritizing visible content on request. */
export default function Banner({
  home = '/',
  img = '/Card-Game-Simulator.png',
  txt = 'Card Game Simulator',
  priority = false,
  sizes = '100vw',
}: BannerProps) {
  const imgDefault = img?.trim() || '/Card-Game-Simulator.png';
  let imgPath = imgDefault;
  try {
    // Match the upload API's URL parsing, including mixed-case schemes and whitespace.
    const url = new URL(imgDefault);
    if (url.protocol === 'https:') {
      imgPath = '/api/proxy/' + url.href.slice('https://'.length);
    }
  } catch {
    // Local public assets are relative paths and do not need the HTTPS proxy.
  }
  const bannerImage = (
    <Image
      className="object-contain rounded"
      src={imgPath}
      alt={txt}
      fill
      sizes={sizes}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
    />
  );

  return (
    <div className="border-none bg-slate-800 flex justify-center items-center w-full h-32">
      {home.startsWith('https://') ? (
        <a
          href={home}
          className="relative flex justify-center items-center w-full h-full"
          target="_blank"
          rel="noopener noreferrer"
        >
          {bannerImage}
        </a>
      ) : (
        <Link href={home} className="relative flex justify-center items-center w-full h-full">
          {bannerImage}
        </Link>
      )}
    </div>
  );
}
