import Link from "next/link";

export default function Footer({ disclaimer }: { disclaimer?: string }) {
  return (
    <footer>
      <hr />
      {disclaimer && <p>{disclaimer}</p>}
      {!disclaimer && <p>Finol Digital LLC ©2023</p>}
      <p>
        <Link href="/">CGS Games</Link>
      </p>
      <p>
        <Link href="/link">CGS Games List</Link>
      </p>
    </footer>
  );
}
