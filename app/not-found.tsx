import Footer from '@/components/footer';
import Link from 'next/link';

/** Displays the existing site-styled missing-resource page and home link. */
export default function Page() {
  return (
    <>
      <main className="main-container">
        <h1>Not Found</h1>
        <p>Could not find requested resource</p>
        <Link href="/">Return Home</Link>
      </main>
      <Footer />
    </>
  );
}
