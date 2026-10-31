import {
  checkRateLimit,
  getClientIp,
  isInternalRequest,
  rateLimitResponseHeaders,
} from '@/lib/rateLimit';

describe('rate limit response fields', () => {
  it('emits structured fields with relative seconds and retains the legacy absolute reset', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(100000);
    try {
      const config = { maxRequests: 10, windowMs: 60000 };
      expect(
        rateLimitResponseHeaders({ allowed: true, remaining: 9, resetAt: 160000 }, config),
      ).toEqual({
        'RateLimit-Policy': '"spoilers";q=10;w=60',
        RateLimit: '"spoilers";r=9;t=60',
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': '9',
        'X-RateLimit-Reset': new Date(160000).toISOString(),
      });
      expect(
        rateLimitResponseHeaders({ allowed: false, remaining: 0, resetAt: 99999 }, config),
      ).toMatchObject({
        RateLimit: '"spoilers";r=0;t=0',
        'Retry-After': '1',
      });
    } finally {
      now.mockRestore();
    }
  });
});

describe('rateLimit', () => {
  describe('checkRateLimit', () => {
    it('should allow first request', () => {
      const result = checkRateLimit('test-key-1', {
        maxRequests: 5,
        windowMs: 60000,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.resetAt).toBeGreaterThan(Date.now());
    });

    it('should track request count within window', () => {
      const key = 'test-key-2';
      const config = { maxRequests: 3, windowMs: 60000 };

      const result1 = checkRateLimit(key, config);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(2);

      const result2 = checkRateLimit(key, config);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(1);

      const result3 = checkRateLimit(key, config);
      expect(result3.allowed).toBe(true);
      expect(result3.remaining).toBe(0);
    });

    it('should block requests after limit exceeded', () => {
      const key = 'test-key-3';
      const config = { maxRequests: 2, windowMs: 60000 };

      checkRateLimit(key, config);
      checkRateLimit(key, config);

      const result = checkRateLimit(key, config);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reset after window expires', () => {
      const key = 'test-key-4';
      const config = { maxRequests: 2, windowMs: 100 }; // Very short window

      checkRateLimit(key, config);
      checkRateLimit(key, config);

      // Wait for window to expire
      return new Promise((resolve) => {
        setTimeout(() => {
          const result = checkRateLimit(key, config);
          expect(result.allowed).toBe(true);
          expect(result.remaining).toBe(1);
          resolve(undefined);
        }, 150);
      });
    });
  });

  describe('getClientIp', () => {
    it('uses the proxy-appended rightmost x-forwarded-for entry, not client-supplied ones', () => {
      const headers = new Headers();
      headers.set('x-forwarded-for', '6.6.6.6, 192.168.1.1');

      const mockRequest = { headers } as Request;
      const ip = getClientIp(mockRequest);
      expect(ip).toBe('192.168.1.1');
    });

    it('ignores client-controlled headers that a platform does not overwrite', () => {
      const headers = new Headers();
      headers.set('x-real-ip', '192.168.1.2');
      headers.set('cf-connecting-ip', '192.168.1.3');
      headers.set('x-vercel-ip', '192.168.1.4');

      const mockRequest = { headers } as Request;
      expect(getClientIp(mockRequest)).toBe('unknown');
    });

    it('should return "unknown" when no IP headers present', () => {
      const headers = new Headers();
      const mockRequest = { headers } as Request;
      const ip = getClientIp(mockRequest);
      expect(ip).toBe('unknown');
    });

    it('prefers the Firebase App Hosting client address over x-forwarded-for', () => {
      const headers = new Headers();
      headers.set('x-forwarded-for', '6.6.6.6, 35.191.0.1');
      headers.set('x-fah-client-ip', '203.0.113.7');

      const mockRequest = { headers } as Request;
      expect(getClientIp(mockRequest)).toBe('203.0.113.7');
    });
  });

  describe('isInternalRequest', () => {
    const original = process.env.K_SERVICE;
    afterEach(() => {
      if (original === undefined) delete process.env.K_SERVICE;
      else process.env.K_SERVICE = original;
    });

    it('treats App Hosting requests without a client address as internal', () => {
      process.env.K_SERVICE = 'cgs-games';
      const internal = { headers: new Headers({ 'x-forwarded-for': '169.254.1.1' }) } as Request;
      const external = { headers: new Headers({ 'x-fah-client-ip': '203.0.113.7' }) } as Request;
      expect(isInternalRequest(internal)).toBe(true);
      expect(isInternalRequest(external)).toBe(false);
    });

    it('never exempts requests outside App Hosting', () => {
      delete process.env.K_SERVICE;
      expect(isInternalRequest({ headers: new Headers() } as Request)).toBe(false);
    });
  });
});
