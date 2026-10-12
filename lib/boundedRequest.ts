/** Signals that a request exceeded its byte budget before it was fully read. */
export class RequestBodyLimitError extends Error {}

/** Reads UTF-8 with a raw-byte limit, cancelling the source as soon as it overflows. */
export async function readBoundedText(request: Request, maxBytes: number): Promise<string> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      size += value.byteLength;
      if (size > maxBytes) {
        void reader.cancel().catch(() => {});
        throw new RequestBodyLimitError('Request body exceeds the permitted byte limit');
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}
