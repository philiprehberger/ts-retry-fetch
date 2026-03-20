import type { FetchOptions, RetryOptions, RetryEvent } from './types.js';
import { calculateDelay, isRetryable, getRetryAfter, sleep } from './retry.js';
import { createTimeoutSignal } from './timeout.js';
import { applyRequestInterceptor, applyResponseInterceptor } from './interceptors.js';
import { buildRequest } from './merge.js';

function normalizeRetryOptions(retry?: RetryOptions | number): RetryOptions {
  if (retry === undefined) return { count: 0 };
  if (typeof retry === 'number') return { count: retry };
  return retry;
}

export function createFetch(options: FetchOptions = {}): typeof fetch {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const retryOptions = normalizeRetryOptions(options.retry);
  const maxAttempts = (retryOptions.count ?? 0) + 1;

  return async function enhancedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    let request = buildRequest(input, init, {
      baseUrl: options.baseUrl,
      defaultHeaders: options.defaultHeaders,
    });

    request = await applyRequestInterceptor(request, options.onRequest);

    let lastError: Error | undefined;
    let lastResponse: Response | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let timeoutCleanup: (() => void) | undefined;
      let signal: AbortSignal | undefined = init?.signal ?? undefined;

      if (options.timeout) {
        const timeout = createTimeoutSignal(options.timeout, signal);
        signal = timeout.signal;
        timeoutCleanup = timeout.cleanup;
      }

      try {
        const requestWithSignal = new Request(request, { signal });
        const response = await fetchImpl(requestWithSignal);

        timeoutCleanup?.();

        if (attempt < maxAttempts && isRetryable(response, retryOptions)) {
          lastResponse = response;

          let delayMs = calculateDelay(attempt, retryOptions);

          if (response.status === 429) {
            const retryAfter = getRetryAfter(response);
            if (retryAfter !== null) {
              delayMs = retryAfter;
            }
          }

          if (options.onRetry) {
            const event: RetryEvent = {
              attempt,
              maxAttempts,
              response,
              request,
            };
            options.onRetry(event);
          }

          await sleep(delayMs);
          continue;
        }

        const finalResponse = await applyResponseInterceptor(response, options.onResponse);
        return finalResponse;
      } catch (error) {
        timeoutCleanup?.();

        const err = error instanceof Error ? error : new Error(String(error));
        lastError = err;

        if (options.onError) {
          options.onError(err);
        }

        if (attempt < maxAttempts) {
          if (options.onRetry) {
            const event: RetryEvent = {
              attempt,
              maxAttempts,
              error: err,
              request,
            };
            options.onRetry(event);
          }

          const delayMs = calculateDelay(attempt, retryOptions);
          await sleep(delayMs);
          continue;
        }

        throw err;
      }
    }

    if (lastResponse) {
      return applyResponseInterceptor(lastResponse, options.onResponse);
    }

    throw lastError ?? new Error('Unexpected retry loop exit');
  } as typeof fetch;
}
