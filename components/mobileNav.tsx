import Image from 'next/image';
import Link from 'next/link';
import cgsLogo from '@/public/cgs.png';

/** Renders the compact mobile home link with a responsive logo. */
export default function MobileNav() {
  return (
    <nav className="md:hidden">
      <Link href="/" className="brownlink flex items-center">
        <Image className="right-12" src={cgsLogo} height={48} width={48} sizes="48px" alt="[CGS]" />
        CGS Games
      </Link>
    </nav>
  );
}
