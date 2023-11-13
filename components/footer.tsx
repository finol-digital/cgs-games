import Link from "next/link";

export default function Footer({ disclaimer }: { disclaimer?: string }) {
  return (
    <footer>
      <hr />
      {disclaimer && <p>{disclaimer}</p>}
      {!disclaimer && <p>Finol Digital LLC ©{new Date().getFullYear()}</p>}
      <p>
        <Link href="/">CGS Games</Link>
      </p>
    </footer>
  );
}
