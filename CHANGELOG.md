# Changelog

## 0.1.0

- Initial release
- `createFetch()` with configurable retry, timeout, and interceptors
- Exponential, linear, and fixed backoff strategies
- Retry-After header support for 429 responses
- Request/response interceptors
- Base URL and default headers
- AbortSignal support for cancellation
- Returns standard `Response` — zero abstraction leak
