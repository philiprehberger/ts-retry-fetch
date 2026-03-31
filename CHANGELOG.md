# Changelog

## 0.1.2

- Standardize README to 3-badge format with emoji Support section
- Update CI actions to v5 for Node.js 24 compatibility
- Add GitHub issue templates, dependabot config, and PR template

## 0.1.1

- Standardize README structure and badges

## 0.1.0

- Initial release
- `createFetch()` with configurable retry, timeout, and interceptors
- Exponential, linear, and fixed backoff strategies
- Retry-After header support for 429 responses
- Request/response interceptors
- Base URL and default headers
- AbortSignal support for cancellation
- Returns standard `Response` — zero abstraction leak
