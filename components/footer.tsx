import Link from 'next/link';

export default function Footer({ copyrightNotice }: { copyrightNotice?: string }) {
  if (!copyrightNotice) {
    copyrightNotice = 'Finol Digital LLC ©' + new Date().getFullYear();
  }
  return (
    <footer>
      <p className="h-px20">
        <i>{copyrightNotice}</i>
      </p>
      <div className="bg-gold h-px140">
        <p>
          <Link href="/" className="brownlink">
            CGS Games
          </Link>
        </p>
        <p className="text-black">
          <Link href="/browse" className="brownlink">
            Browse
          </Link>{' '}
          |{' '}
          <Link href="/upload" className="brownlink">
            Upload
          </Link>
        </p>
        <p className="text-black">
          <Link href="/terms" className="brownlink">
            Terms
          </Link>{' '}
          |{' '}
          <Link href="/privacy" className="brownlink">
            Privacy
          </Link>
        </p>
        <br></br>
      </div>
    </footer>
  );
}
