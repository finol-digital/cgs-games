import Link from 'next/link';
import InformationPage from '@/components/informationPage';
import { organization, publicPageMetadata } from '@/lib/siteIdentity';

export const metadata = publicPageMetadata(
  'Contact CGS Games | Finol Digital LLC',
  'Contact Finol Digital LLC for CGS Games support, game listing questions, privacy, and API issues.',
  '/contact',
);

export default function ContactPage() {
  return (
    <InformationPage title="Contact CGS Games">
      <p>
        CGS Games is operated by Finol Digital LLC. For help with the website, a game listing, your
        creator account, or a developer integration, email{' '}
        <a href={`mailto:${organization.contactPoint.email}`}>{organization.contactPoint.email}</a>.
        This is the contact address published in our Terms and Privacy Policy.
      </p>
      <h2>Help us understand your request</h2>
      <p>
        Include the relevant CGS Games page URL, your public creator username when applicable, and a
        short description of what happened and what you expected. For API issues, include the
        endpoint, HTTP status, and error code. Never send passwords, Firebase ID tokens, operator
        secrets, or private game files in a support request.
      </p>
      <h2>Privacy and content questions</h2>
      <p>
        For a privacy request or concern about content shared on the site, describe the information
        or listing involved so we can identify it. The <Link href="/privacy">Privacy Policy</Link>{' '}
        and <Link href="/terms">Terms of Use</Link> provide the full policies. For integration
        examples and authentication guidance, start with the{' '}
        <Link href="/developers">developer portal</Link>.
      </p>
      <h2>Mailing address</h2>
      <address className="not-italic">
        {organization.name}
        <br />
        {organization.address.streetAddress}
        <br />
        {organization.address.addressLocality}, {organization.address.addressRegion}{' '}
        {organization.address.postalCode}
        <br />
        United States
      </address>
    </InformationPage>
  );
}
