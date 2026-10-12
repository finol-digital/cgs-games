/** @jest-environment node */
import { readBoundedText, RequestBodyLimitError } from '@/lib/boundedRequest';

/** Builds a pull-driven request so tests can detect over-reading and cancellation. */
function streamedRequest(chunks: Uint8Array[], headers?: Record<string, string>) {
  const cancel = jest.fn();
  let pulled = 0;
  const body = new ReadableStream(
    {
      pull(controller) {
        const chunk = chunks[pulled++];
        if (chunk) controller.enqueue(chunk);
        else controller.close();
      },
      cancel,
    },
    { highWaterMark: 0 },
  );
  const options = {
    method: 'POST',
    body,
    headers,
    duplex: 'half',
  };
  const request = new Request('https://cgs.games/api/proxy/example.com/', options);
  return { request, cancel, pulled: () => pulled };
}

it.each([undefined, { 'Content-Length': '1' }])(
  'cancels chunked/understated input on the first excess byte (%j)',
  async (headers) => {
    const fixture = streamedRequest(
      [new Uint8Array(4), new Uint8Array(1), new Uint8Array(100)],
      headers,
    );
    await expect(readBoundedText(fixture.request, 4)).rejects.toBeInstanceOf(RequestBodyLimitError);
    expect(fixture.pulled()).toBe(2);
    expect(fixture.cancel).toHaveBeenCalledTimes(1);
  },
);

it('preserves UTF-8 split across chunks at the exact byte limit', async () => {
  const bytes = new TextEncoder().encode('a€');
  const fixture = streamedRequest([bytes.slice(0, 2), bytes.slice(2)]);
  await expect(readBoundedText(fixture.request, 4)).resolves.toBe('a€');
  expect(fixture.cancel).not.toHaveBeenCalled();
});

it('accepts an empty request body', async () => {
  await expect(readBoundedText(new Request('https://example.com'), 4)).resolves.toBe('');
});
