import Link from 'next/link';

/** Displays attribution and site navigation without prefetching the upload workflow. */
export default function Footer({ copyrightNotice }: { copyrightNotice?: string }) {
  if (!copyrightNotice) {
    copyrightNotice = 'Finol Digital LLC ©' + new Date().getFullYear();
  }
  return (
    <footer>
      <p className="py-2 text-center">
        <i>{copyrightNotice}</i>
      </p>
      <div className="bg-[var(--color-gold)] px-4 py-3">
        <p className="text-center">
          <Link href="/" className="brownlink">
            CGS Games
          </Link>
        </p>
        <p className="text-black">
          <Link href="/browse" className="brownlink">
            Browse
          </Link>{' '}
          |{' '}
          <Link href="/upload" prefetch={false} className="brownlink">
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
        <p className="text-black">
          <Link href="/about" className="brownlink">
            About
          </Link>{' '}
          |{' '}
          <Link href="/contact" className="brownlink">
            Contact
          </Link>{' '}
          |{' '}
          <Link href="/developers" className="brownlink">
            Developers
          </Link>
        </p>
      </div>
    </footer>
  );
}
