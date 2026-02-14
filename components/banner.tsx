import Link from 'next/link';

export default function Banner({
  home = '/',
  img = '/Card-Game-Simulator.png',
  txt = 'Card Game Simulator',
}: {
  home?: string;
  img?: string;
  txt?: string;
}) {
  const imgDefault = img ?? '/Card-Game-Simulator.png';
  const imgPath =
    img && img.startsWith('https://') ? '/api/proxy/' + img.replace(/^https:\/\//, '') : imgDefault;

  return (
    <div className="border-none bg-slate-800 flex justify-center items-center w-full h-32">
      {home.startsWith('https://') ? (
        <a
          href={home}
          className="flex justify-center items-center w-full h-full"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img className="object-contain rounded w-full h-full" src={imgPath} alt={txt} />
        </a>
      ) : (
        <Link href={home} className="flex justify-center items-center w-full h-full">
          <img className="object-contain rounded w-full h-full" src={imgPath} alt={txt} />
        </Link>
      )}
    </div>
  );
}
