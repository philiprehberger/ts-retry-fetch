import type { RetryOptions, BackoffStrategy } from './types.js';

const DEFAULT_RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504];
const DEFAULT_DELAY = 1000;
const DEFAULT_MAX_DELAY = 30000;

export function calculateDelay(attempt: number, options: RetryOptions): number {
  const strategy: BackoffStrategy = options.backoff ?? 'exponential';
  const baseDelay = options.delay ?? DEFAULT_DELAY;
  const maxDelay = options.maxDelay ?? DEFAULT_MAX_DELAY;

  let delay: number;

  switch (strategy) {
    case 'fixed':
      delay = baseDelay;
      break;
    case 'linear':
      delay = baseDelay * attempt;
      break;
    case 'exponential':
      delay = baseDelay * Math.pow(2, attempt - 1);
      break;
  }

  if (options.jitter) {
    const jitterAmount = delay * 0.3 * Math.random();
    delay += jitterAmount;
  }

  return Math.min(delay, maxDelay);
}

export function isRetryable(response: Response, options: RetryOptions): boolean {
  if (options.retryOn) {
    return options.retryOn(response);
  }

  const statuses = options.retryableStatuses ?? DEFAULT_RETRYABLE_STATUSES;
  return statuses.includes(response.status);
}

export function getRetryAfter(response: Response): number | null {
  const header = response.headers.get('Retry-After');
  if (!header) return null;

  const seconds = Number(header);
  if (!Number.isNaN(seconds)) {
    return seconds * 1000;
  }

  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    const delayMs = date - Date.now();
    return delayMs > 0 ? delayMs : 0;
  }

  return null;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
