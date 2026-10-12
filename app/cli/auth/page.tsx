import InformationPage from '@/components/informationPage';
import CliAuthorization from '@/components/cliAuthorization';

export const metadata = {
  title: 'Authorize CGS Games CLI',
  robots: { index: false, follow: false },
  // Form navigation needs a non-null Origin for the CLI's origin check, including HTTPS to loopback.
  // https://fetch.spec.whatwg.org/#append-a-request-origin-header
  referrer: 'origin' as const,
};

/** Presents an explicit approval step before handing a short-lived token to the local CLI. */
export default function CliAuthPage() {
  return (
    <InformationPage title="Authorize CGS Games CLI">
      <p>
        Sign in with Google, then authorize the CLI you started on this computer. It can publish
        games as your account until this sign-in expires (up to one hour). Only approve a sign-in
        you started yourself. Your Google password and refresh token stay in the browser.
      </p>
      <CliAuthorization />
    </InformationPage>
  );
}
