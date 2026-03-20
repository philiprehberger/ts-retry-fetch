import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createFetch, calculateDelay } from '../../dist/index.js';

function mockResponse(status: number, headers?: Record<string, string>, body?: string): Response {
  return new Response(body ?? '', {
    status,
    headers: new Headers(headers),
  });
}

function createMockFetch(responses: Response[]): typeof fetch {
  let callIndex = 0;
  const fn = mock.fn(async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    const response = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;
    return response;
  });
  return fn as unknown as typeof fetch;
}

describe('createFetch', () => {
  it('returns a function', () => {
    const f = createFetch();
    assert.equal(typeof f, 'function');
  });

  it('prepends baseUrl to relative URLs', async () => {
    const calls: string[] = [];
    const mockFetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
      const req = input instanceof Request ? input : new Request(input);
      calls.push(req.url);
      return mockResponse(200);
    };

    const f = createFetch({
      baseUrl: 'https://api.example.com',
      fetch: mockFetchImpl as typeof fetch,
    });

    await f('/users');
    assert.equal(calls[0], 'https://api.example.com/users');
  });

  it('does not prepend baseUrl to absolute URLs', async () => {
    const calls: string[] = [];
    const mockFetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
      const req = input instanceof Request ? input : new Request(input);
      calls.push(req.url);
      return mockResponse(200);
    };

    const f = createFetch({
      baseUrl: 'https://api.example.com',
      fetch: mockFetchImpl as typeof fetch,
    });

    await f('https://other.example.com/data');
    assert.equal(calls[0], 'https://other.example.com/data');
  });

  it('applies defaultHeaders', async () => {
    const capturedHeaders: Headers[] = [];
    const mockFetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
      const req = input instanceof Request ? input : new Request(input);
      capturedHeaders.push(req.headers);
      return mockResponse(200);
    };

    const f = createFetch({
      defaultHeaders: { 'Authorization': 'Bearer token123', 'X-Custom': 'value' },
      fetch: mockFetchImpl as typeof fetch,
    });

    await f('https://api.example.com/data');
    assert.equal(capturedHeaders[0].get('Authorization'), 'Bearer token123');
    assert.equal(capturedHeaders[0].get('X-Custom'), 'value');
  });

  it('timeout rejects with AbortError', async () => {
    const mockFetchImpl = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      return new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error('should not reach')), 10000);
        if (init?.signal) {
          init.signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(init.signal!.reason);
          });
        }
      });
    };

    const f = createFetch({
      timeout: 50,
      fetch: mockFetchImpl as typeof fetch,
    });

    await assert.rejects(() => f('https://api.example.com/slow'), (err: unknown) => {
      assert.ok(err instanceof DOMException || err instanceof Error);
      if (err instanceof DOMException) {
        assert.equal(err.name, 'AbortError');
      }
      return true;
    });
  });

  it('retries on 500 status', async () => {
    let callCount = 0;
    const mockFetchImpl = async (): Promise<Response> => {
      callCount++;
      if (callCount < 3) {
        return mockResponse(500);
      }
      return mockResponse(200);
    };

    const f = createFetch({
      retry: { count: 3, delay: 10, backoff: 'fixed' },
      fetch: mockFetchImpl as typeof fetch,
    });

    const response = await f('https://api.example.com/data');
    assert.equal(response.status, 200);
    assert.equal(callCount, 3);
  });

  it('stops retrying after count exhausted', async () => {
    let callCount = 0;
    const mockFetchImpl = async (): Promise<Response> => {
      callCount++;
      return mockResponse(500);
    };

    const f = createFetch({
      retry: { count: 2, delay: 10, backoff: 'fixed' },
      fetch: mockFetchImpl as typeof fetch,
    });

    const response = await f('https://api.example.com/data');
    assert.equal(response.status, 500);
    assert.equal(callCount, 3); // 1 initial + 2 retries
  });

  it('calls onRetry callback with correct event data', async () => {
    const retryEvents: Array<{ attempt: number; maxAttempts: number }> = [];
    let callCount = 0;
    const mockFetchImpl = async (): Promise<Response> => {
      callCount++;
      if (callCount < 3) return mockResponse(503);
      return mockResponse(200);
    };

    const f = createFetch({
      retry: { count: 3, delay: 10, backoff: 'fixed' },
      onRetry: (event) => {
        retryEvents.push({ attempt: event.attempt, maxAttempts: event.maxAttempts });
      },
      fetch: mockFetchImpl as typeof fetch,
    });

    await f('https://api.example.com/data');
    assert.equal(retryEvents.length, 2);
    assert.equal(retryEvents[0].attempt, 1);
    assert.equal(retryEvents[0].maxAttempts, 4); // count + 1
    assert.equal(retryEvents[1].attempt, 2);
  });

  it('interceptors modify request and response', async () => {
    const capturedHeaders: Headers[] = [];
    const mockFetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
      const req = input instanceof Request ? input : new Request(input);
      capturedHeaders.push(req.headers);
      return mockResponse(200, {}, '{"data": "original"}');
    };

    const f = createFetch({
      onRequest: (req) => {
        const modified = new Request(req, {
          headers: new Headers({
            ...Object.fromEntries(req.headers.entries()),
            'X-Intercepted': 'true',
          }),
        });
        return modified;
      },
      onResponse: (res) => {
        return new Response(res.body, {
          status: res.status,
          headers: new Headers({
            ...Object.fromEntries(res.headers.entries()),
            'X-Modified': 'true',
          }),
        });
      },
      fetch: mockFetchImpl as typeof fetch,
    });

    const response = await f('https://api.example.com/data');
    assert.equal(capturedHeaders[0].get('X-Intercepted'), 'true');
    assert.equal(response.headers.get('X-Modified'), 'true');
  });
});

describe('calculateDelay', () => {
  it('fixed backoff returns constant delay', () => {
    const delay = calculateDelay(3, { backoff: 'fixed', delay: 500 });
    assert.equal(delay, 500);
  });

  it('linear backoff scales with attempt', () => {
    const delay = calculateDelay(3, { backoff: 'linear', delay: 500 });
    assert.equal(delay, 1500);
  });

  it('exponential backoff doubles each attempt', () => {
    const d1 = calculateDelay(1, { backoff: 'exponential', delay: 1000 });
    const d2 = calculateDelay(2, { backoff: 'exponential', delay: 1000 });
    const d3 = calculateDelay(3, { backoff: 'exponential', delay: 1000 });
    assert.equal(d1, 1000);
    assert.equal(d2, 2000);
    assert.equal(d3, 4000);
  });

  it('caps delay at maxDelay', () => {
    const delay = calculateDelay(10, { backoff: 'exponential', delay: 1000, maxDelay: 5000 });
    assert.equal(delay, 5000);
  });

  it('jitter adds variability', () => {
    const delays = new Set<number>();
    for (let i = 0; i < 20; i++) {
      delays.add(calculateDelay(1, { backoff: 'fixed', delay: 1000, jitter: true }));
    }
    assert.ok(delays.size > 1, 'jitter should produce varying delays');
  });
});
