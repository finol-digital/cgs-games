import Link from "next/link";

export default function Footer({ disclaimer }: { disclaimer?: string }) {
  return (
    <footer>
      {disclaimer && (
        <p>
          <i>{disclaimer}</i>
        </p>
      )}
      {!disclaimer && (
        <p>
          <i>Finol Digital LLC ©{new Date().getFullYear()}</i>
        </p>
      )}
      <hr />
      <p>
        <Link href="/">CGS Games</Link>
      </p>
      <p>
        <Link href="/list">List</Link> | <Link href="/upload">Upload</Link>
      </p>
      <p>
        <Link href="/terms">Terms</Link> | <Link href="/privacy">Privacy</Link>
      </p>
    </footer>
  );
}
