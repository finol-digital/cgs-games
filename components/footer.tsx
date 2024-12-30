import Link from "next/link";

export default function Footer({
  copyrightNotice,
}: {
  copyrightNotice?: string;
}) {
  if (!copyrightNotice) {
    copyrightNotice = "Finol Digital LLC ©" + new Date().getFullYear();
  }
  return (
    <footer>
      <p>
        <i>{copyrightNotice}</i>
      </p>
      <div className="bg-[#D3BD7A]">
        <p>
          <Link href="/">CGS Games</Link>
        </p>
        <p>
          <Link href="/browse">Browse</Link> |{" "}
          <Link href="/upload">Upload</Link>
        </p>
        <p>
          <Link href="/terms">Terms</Link> |{" "}
          <Link href="/privacy">Privacy</Link>
        </p>
        <br></br>
      </div>
    </footer>
  );
}
