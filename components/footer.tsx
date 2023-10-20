import Link from "next/link";

export default function Footer() {
  return (
    <footer>
      <hr />
      <p>
        <Link href="/">CGS Games Homepage</Link>
      </p>
      <p>
        <Link href="/link">CGS Games List</Link>
      </p>
    </footer>
  );
}
