import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

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
    it('should extract IP from x-forwarded-for header', () => {
      const headers = new Headers();
      headers.set('x-forwarded-for', '192.168.1.1, 10.0.0.1');

      const mockRequest = { headers } as Request;
      const ip = getClientIp(mockRequest);
      expect(ip).toBe('192.168.1.1');
    });

    it('should extract IP from x-real-ip header', () => {
      const headers = new Headers();
      headers.set('x-real-ip', '192.168.1.2');

      const mockRequest = { headers } as Request;
      const ip = getClientIp(mockRequest);
      expect(ip).toBe('192.168.1.2');
    });

    it('should extract IP from cf-connecting-ip header', () => {
      const headers = new Headers();
      headers.set('cf-connecting-ip', '192.168.1.3');

      const mockRequest = { headers } as Request;
      const ip = getClientIp(mockRequest);
      expect(ip).toBe('192.168.1.3');
    });

    it('should return "unknown" when no IP headers present', () => {
      const headers = new Headers();
      const mockRequest = { headers } as Request;
      const ip = getClientIp(mockRequest);
      expect(ip).toBe('unknown');
    });

    it('should prioritize x-forwarded-for over other headers', () => {
      const headers = new Headers();
      headers.set('x-forwarded-for', '192.168.1.1');
      headers.set('x-real-ip', '192.168.1.2');
      headers.set('cf-connecting-ip', '192.168.1.3');

      const mockRequest = { headers } as Request;
      const ip = getClientIp(mockRequest);
      expect(ip).toBe('192.168.1.1');
    });
  });
});
