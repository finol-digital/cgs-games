import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Page from '@/app/page';
import CreatorPage from '@/app/[username]/page';
import MissingPage from '@/app/not-found';
import GamesDeck from '@/components/gamesDeck';
import { adminCreatorExists, adminGetGamesFor } from '@/lib/firebase/admin';
import { homepageParagraphs, homepageMarkdown } from '@/lib/siteContent';

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
  it('includes over 500 characters of visible homepage prose before JavaScript', async () => {
    const html = renderToStaticMarkup(await Page());
    const element = document.createElement('div');
    element.innerHTML = html;
    expect(element.querySelectorAll('h1')).toHaveLength(1);
    expect(element.querySelector('main')!.textContent!.length).toBeGreaterThan(500);
    expect(element.querySelector('h3')).toBeNull();
    for (const paragraph of homepageParagraphs) {
      expect(element.textContent).toContain(paragraph);
      expect(homepageMarkdown).toContain(paragraph);
    }
    expect(element.querySelector('a[href="/upload"]')).not.toBeNull();
    expect(element.querySelector('a[href="/browse"]')).not.toBeNull();
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
