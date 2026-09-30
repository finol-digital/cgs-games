import Link from 'next/link';
import Image from 'next/image';

interface BannerProps {
  home?: string;
  img?: string;
  txt?: string;
  priority?: boolean;
  sizes?: string;
}

export default function Banner({
  home = '/',
  img = '/Card-Game-Simulator.png',
  txt = 'Card Game Simulator',
  priority = false,
  sizes = '100vw',
}: BannerProps) {
  const imgDefault = img ?? '/Card-Game-Simulator.png';
  const imgPath =
    img && img.startsWith('https://') ? '/api/proxy/' + img.replace(/^https:\/\//, '') : imgDefault;
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
