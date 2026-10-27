import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import HeaderSearch from '@/components/headerSearch';
import { SearchGame } from '@/lib/gameSearch';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const games: SearchGame[] = [
  {
    id: '1',
    name: 'Grand Archive',
    username: 'alice',
    slug: 'grand_archive',
    copyright: 'Weebs of the Shore',
    bannerImageUrl: 'https://example.com/banner.png',
  },
  {
    id: '2',
    name: 'Grand Archive Starter Decks',
    username: 'bob',
    slug: 'starter_decks',
    copyright: '',
    bannerImageUrl: '',
  },
  { id: '3', name: 'Chess', username: 'carol', slug: 'chess', copyright: '', bannerImageUrl: '' },
];
const originalFetch = global.fetch;

beforeEach(() => {
  push.mockReset();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => games });
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

function search(query: string) {
  const input = screen.getByRole('combobox', { name: 'Search games' });
  fireEvent.change(input, { target: { value: query } });
  return input;
}

describe('header game search', () => {
  it('loads lazily and reuses the catalog while typing and reopening', async () => {
    render(<HeaderSearch />);
    fireEvent.focus(screen.getByRole('combobox'));
    expect(global.fetch).not.toHaveBeenCalled();
    const input = search('grand');
    expect(await screen.findAllByRole('option')).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent('2 games found');
    search('chess');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.focus(input);
    expect(screen.getByRole('option')).toHaveTextContent('Chess');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('shows loading, then matches the current query when a request finishes', async () => {
    const { promise, resolve } = Promise.withResolvers<unknown>();
    global.fetch = jest.fn().mockReturnValue(promise);
    render(<HeaderSearch />);
    search('grand');
    expect(screen.getByRole('status')).toHaveTextContent('Loading games');
    search('chess');
    await act(async () => resolve({ ok: true, json: async () => games }));
    expect(screen.getByRole('option')).toHaveTextContent('Chess');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it.each([' ALICE ', 'GRAND_ARCHIVE', 'weebs of the shore'])(
    'matches the same creator, slug, and copyright fields as Browse (%s)',
    async (query) => {
      render(<HeaderSearch />);
      search(query);
      expect(await screen.findByRole('option')).toHaveTextContent('Grand Archive');
    },
  );

  it('caps suggestions at five and keeps the total count and Browse link', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => Array.from({ length: 7 }, (_, i) => ({ ...games[0], id: String(i) })),
    });
    render(<HeaderSearch />);
    search(' grand ');
    expect(await screen.findAllByRole('option')).toHaveLength(5);
    expect(screen.getByRole('status')).toHaveTextContent('7 games found');
    expect(screen.getByRole('link', { name: /See all results/ })).toHaveAttribute(
      'href',
      '/browse?q=grand',
    );
  });

  it('navigates selected results with arrows and Enter and clears the selection on edits', async () => {
    render(<HeaderSearch />);
    const input = search('grand');
    await screen.findAllByRole('option');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    const option = screen.getAllByRole('option')[0];
    expect(input).toHaveAttribute('aria-activedescendant', option.id);
    expect(option).toHaveAttribute('aria-selected', 'true');
    fireEvent.submit(screen.getByRole('search'));
    expect(push).toHaveBeenCalledWith('/alice/grand_archive');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    search('chess');
    expect(input).not.toHaveAttribute('aria-activedescendant');
    fireEvent.submit(screen.getByRole('search'));
    expect(push).toHaveBeenLastCalledWith('/browse?q=chess');
  });

  it('uses encoded query strings and allows a normal Browse submission without a selection', async () => {
    render(<HeaderSearch />);
    search('A&B #1');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('No games found'));
    fireEvent.submit(screen.getByRole('search'));
    expect(push).toHaveBeenCalledWith('/browse?q=A%26B+%231');
  });

  it('dismisses on outside interaction and focus leaving, but keeps the Browse link usable', async () => {
    render(<HeaderSearch />);
    const input = search('grand');
    await screen.findAllByRole('option');
    fireEvent.blur(input, { relatedTarget: screen.getByRole('link', { name: /See all results/ }) });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.focus(input);
    fireEvent.blur(input, { relatedTarget: null });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('keeps direct links and falls back safely when thumbnails fail', async () => {
    render(<HeaderSearch />);
    search('grand');
    const options = await screen.findAllByRole('option');
    expect(options[0]).toHaveAttribute('href', '/alice/grand_archive');
    const image = options[0].querySelector('img')!;
    expect(image).toHaveAttribute('src', '/api/proxy/example.com/banner.png');
    fireEvent.error(image);
    expect(image).toHaveAttribute('src', '/CardBack.png');
    fireEvent.error(image);
    expect(image).toHaveAttribute('src', '/CardBack.png');
  });

  it('shows an empty state and clears without requesting the catalog again', async () => {
    render(<HeaderSearch />);
    const input = search('missing game');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('No games found'));
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    { ok: false, status: 503 },
    { ok: true, json: async () => ({ error: 'invalid response' }) },
  ])('keeps Browse available and supports retry after a failed request', async (response) => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.mocked(global.fetch).mockResolvedValueOnce(response as unknown as Response);
    render(<HeaderSearch />);
    search('grand');
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeEnabled();
    expect(screen.getByRole('link', { name: /See all results/ })).toHaveAttribute(
      'href',
      '/browse?q=grand',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findAllByRole('option')).toHaveLength(2);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('aborts the catalog request on unmount', async () => {
    global.fetch = jest.fn().mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const { unmount } = render(<HeaderSearch />);
    search('grand');
    const signal = jest.mocked(global.fetch).mock.calls[0][1]!.signal!;
    await act(async () => unmount());
    expect(signal.aborted).toBe(true);
  });
});
