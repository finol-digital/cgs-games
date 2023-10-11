import Link from "next/link";

export default async function Footer() {
  return (
    <footer>
      <hr></hr>
      <p>
        <Link href="/">CGS Games Homepage</Link>
      </p>
      <p>
        <Link href="https://www.cardgamesimulator.com">CGS Website</Link>
      </p>
      <p>
        <Link href="https://github.com/finol-digital/Card-Game-Simulator/wiki">
          CGS Wiki
        </Link>
      </p>
    </footer>
  );
}
