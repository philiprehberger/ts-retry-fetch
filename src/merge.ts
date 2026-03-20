import type { FetchOptions } from './types.js';

export function mergeHeaders(
  defaults?: Record<string, string>,
  override?: HeadersInit,
): Headers {
  const headers = new Headers();

  if (defaults) {
    for (const [key, value] of Object.entries(defaults)) {
      headers.set(key, value);
    }
  }

  if (override) {
    const overrideHeaders = new Headers(override);
    overrideHeaders.forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return headers;
}

export function buildRequest(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  options: Pick<FetchOptions, 'baseUrl' | 'defaultHeaders'>,
): Request {
  let url: string | URL;

  if (typeof input === 'string') {
    if (options.baseUrl && !input.startsWith('http://') && !input.startsWith('https://')) {
      const base = options.baseUrl.endsWith('/') ? options.baseUrl.slice(0, -1) : options.baseUrl;
      const path = input.startsWith('/') ? input : `/${input}`;
      url = `${base}${path}`;
    } else {
      url = input;
    }
  } else {
    url = input;
  }

  const headers = mergeHeaders(options.defaultHeaders, init?.headers);

  return new Request(url, { ...init, headers });
}
