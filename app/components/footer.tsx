import Link from "next/link";

export default async function Footer() {
  return (
    <footer className="">
      <hr></hr>
      <p>
        <Link href="https://cgs.games">CGS Games Homepage</Link>
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
