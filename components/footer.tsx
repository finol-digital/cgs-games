import Link from "next/link";

export default function Footer({
  linkToList = false,
}: {
  linkToList?: boolean;
}) {
  return (
    <footer>
      <hr />
      <p>
        <Link href="/">CGS Games Homepage</Link>
      </p>
      {linkToList && (
        <p>
          <Link href="/link">CGS Games List</Link>
        </p>
      )}
      {!linkToList && (
        <p>
          <Link href="https://www.cardgamesimulator.com">
            www.cardgamesimulator.com
          </Link>
        </p>
      )}
    </footer>
  );
}
