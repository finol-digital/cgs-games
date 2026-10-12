import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Page from '@/app/page';
import CreatorPage from '@/app/[username]/page';
import MissingPage from '@/app/not-found';
import GamesDeck from '@/components/gamesDeck';
import { adminCreatorExists, adminGetGamesFor } from '@/lib/firebase/admin';
import { homepageParagraphs, homepageMarkdown } from '@/lib/siteContent';
import AboutPage from '@/app/about/page';
import ContactPage from '@/app/contact/page';
import DevelopersPage from '@/app/developers/page';
import { metadata } from '@/app/page';

jest.mock('@/lib/firebase/admin', () => ({
  adminGetGames: jest.fn().mockResolvedValue([]),
  adminGetGamesFor: jest.fn().mockResolvedValue([]),
  adminCreatorExists: jest.fn(),
}));
jest.mock('@/components/gameCard', () => () => null);
jest.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404');
  },
}));

describe('server-rendered content', () => {
  it('keeps the original homepage copy and navigation available before JavaScript', async () => {
    const html = renderToStaticMarkup(await Page());
    const element = document.createElement('div');
    element.innerHTML = html;
    expect(element.querySelectorAll('h1')).toHaveLength(1);
    expect(element.querySelector('main')!.textContent).toContain(
      'Welcome to the Card Game Simulator (CGS) Games website!',
    );
    expect(element.querySelector('h3')).toBeNull();
    for (const paragraph of homepageParagraphs) {
      expect(element.querySelector('main')!.textContent).toContain(paragraph);
    }
    expect(element.querySelector('main')!.textContent!.length).toBeGreaterThan(500);
    expect(element.querySelector('a[href="/developers"]')).not.toBeNull();
    const data = JSON.parse(
      element.querySelector('script[type="application/ld+json"]')!.textContent!,
    );
    expect(data['@context']).toBe('https://schema.org');
    const organization = data['@graph'].find(
      (entry: { '@type': string }) => entry['@type'] === 'Organization',
    );
    expect(organization.contactPoint.email).toBe('david@finoldigital.com');
    expect(organization.address['@type']).toBe('PostalAddress');
    expect(organization.address.streetAddress).toBe('17350 State Hwy 249, Ste 220');
    expect(metadata.alternates?.canonical).toBe('/');
    expect(metadata.title).toContain('Card Game Simulator');
    expect(element.querySelector('a[href="/upload"]')).not.toBeNull();
    expect(element.querySelector('a[href="/browse"]')).not.toBeNull();
  });

  it.each([AboutPage, ContactPage, DevelopersPage])(
    'renders public information without JavaScript',
    (Component) => {
      const element = document.createElement('div');
      element.innerHTML = renderToStaticMarkup(<Component />);
      expect(element.querySelectorAll('h1')).toHaveLength(1);
      expect(element.querySelector('main')!.textContent!.length).toBeGreaterThan(500);
      expect(element.querySelector('a[href="/developers"]')).not.toBeNull();
      expect(element.querySelector('h3,h4,h5,h6')).toBeNull();
    },
  );

  it('retains the detailed introduction in the agent-facing Markdown response', () => {
    expect(homepageMarkdown.length).toBeGreaterThan(500);
    expect(homepageMarkdown).toContain('# CGS Games');
    for (const paragraph of homepageParagraphs) {
      expect(homepageMarkdown).toContain(paragraph);
    }
  });

  it('uses a paragraph for an empty collection and an H1 for the missing page', () => {
    expect(renderToStaticMarkup(<GamesDeck games={[]} />)).toContain('<p');
    expect(renderToStaticMarkup(<MissingPage />)).toContain('<h1>Not Found</h1>');
  });

  it('rejects missing creators while retaining registered empty collections', async () => {
    jest.mocked(adminGetGamesFor).mockResolvedValue([]);
    jest.mocked(adminCreatorExists).mockResolvedValue(false);
    await expect(CreatorPage({ params: Promise.resolve({ username: 'missing' }) })).rejects.toThrow(
      '404',
    );
    jest.mocked(adminCreatorExists).mockResolvedValue(true);
    const html = renderToStaticMarkup(
      await CreatorPage({ params: Promise.resolve({ username: 'new-creator' }) }),
    );
    expect(html).toContain('No games found.');
  });
});
