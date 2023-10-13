import Link from "next/link";

export default async function Footer() {
  return (
    <footer>
      <hr></hr>
      <p>
        <Link href="/">CGS Games Homepage</Link>
      </p>
      <p>
        <Link href="https://www.cardgamesimulator.com">
          www.cardgamesimulator.com
        </Link>
      </p>
    </footer>
  );
}
