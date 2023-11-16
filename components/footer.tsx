import Link from "next/link";

export default function Footer({ disclaimer }: { disclaimer?: string }) {
  return (
    <footer>
      <hr />
      {disclaimer && <p>{disclaimer}</p>}
      {!disclaimer && <p>Finol Digital LLC ©{new Date().getFullYear()}</p>}
      <p>
        <Link href="/">CGS Games</Link>
        <Link href="/list">CGS Games List</Link>
        <Link href="/upload">CGS Games Upload</Link>
      </p>
    </footer>
  );
}
