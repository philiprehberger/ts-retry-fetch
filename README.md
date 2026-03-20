# @philiprehberger/retry-fetch

[![CI](https://github.com/philiprehberger/ts-retry-fetch/actions/workflows/ci.yml/badge.svg)](https://github.com/philiprehberger/ts-retry-fetch/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@philiprehberger/retry-fetch)](https://www.npmjs.com/package/@philiprehberger/retry-fetch)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Fetch wrapper with retries, timeout, and interceptors — zero abstraction leak

## Requirements

- Node.js >= 18.0.0

## Installation

```bash
npm install @philiprehberger/retry-fetch
```

## Usage

### Basic retry

```ts
import { createFetch } from '@philiprehberger/retry-fetch';

const fetchWithRetry = createFetch({
  retry: { count: 3, backoff: 'exponential' },
});

const response = await fetchWithRetry('https://api.example.com/data');
```

### Timeout

```ts
const fetchWithTimeout = createFetch({
  timeout: 5000,
  retry: 2,
});

const response = await fetchWithTimeout('https://api.example.com/data');
```

### Base URL and default headers

```ts
const api = createFetch({
  baseUrl: 'https://api.example.com',
  defaultHeaders: {
    'Authorization': 'Bearer my-token',
    'Content-Type': 'application/json',
  },
  retry: { count: 2, delay: 500 },
});

const response = await api('/users');
```

### Interceptors

```ts
const api = createFetch({
  onRequest: (request) => {
    console.log(`→ ${request.method} ${request.url}`);
    return request;
  },
  onResponse: (response) => {
    console.log(`← ${response.status}`);
    return response;
  },
  onError: (error) => {
    console.error('Request failed:', error.message);
  },
  onRetry: (event) => {
    console.log(`Retry ${event.attempt}/${event.maxAttempts}`);
  },
});
```

### Custom retry logic

```ts
const api = createFetch({
  retry: {
    count: 5,
    backoff: 'linear',
    delay: 1000,
    maxDelay: 10000,
    jitter: true,
    retryOn: (response) => response.status >= 500,
  },
});
```

## API

### `createFetch(options?)`

Returns a `fetch`-compatible function with the configured behavior.

| Option | Type | Default | Description |
|---|---|---|---|
| `baseUrl` | `string` | — | Prepended to relative URLs |
| `timeout` | `number` | — | Request timeout in milliseconds |
| `retry` | `RetryOptions \| number` | `0` | Retry configuration or simple retry count |
| `defaultHeaders` | `Record<string, string>` | — | Headers applied to every request |
| `onRetry` | `(event: RetryEvent) => void` | — | Called before each retry attempt |
| `onRequest` | `(req: Request) => Request` | — | Request interceptor |
| `onResponse` | `(res: Response) => Response` | — | Response interceptor |
| `onError` | `(error: Error) => void` | — | Error handler |
| `fetch` | `typeof fetch` | `globalThis.fetch` | Custom fetch implementation |

### `RetryOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `count` | `number` | `0` | Number of retry attempts |
| `backoff` | `'fixed' \| 'linear' \| 'exponential'` | `'exponential'` | Backoff strategy |
| `delay` | `number` | `1000` | Base delay in milliseconds |
| `maxDelay` | `number` | `30000` | Maximum delay cap |
| `jitter` | `boolean` | `false` | Add random 0-30% jitter to delay |
| `retryOn` | `(res: Response) => boolean` | — | Custom retry predicate |
| `retryableStatuses` | `number[]` | `[408, 429, 500, 502, 503, 504]` | Status codes that trigger retry |

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
