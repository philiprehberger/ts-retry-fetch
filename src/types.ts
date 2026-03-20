export type BackoffStrategy = 'fixed' | 'linear' | 'exponential';

export interface RetryOptions {
  count?: number;
  backoff?: BackoffStrategy;
  delay?: number;
  maxDelay?: number;
  jitter?: boolean;
  retryOn?: (response: Response) => boolean;
  retryableStatuses?: number[];
}

export interface Interceptors {
  onRequest?: (request: Request) => Request | Promise<Request>;
  onResponse?: (response: Response) => Response | Promise<Response>;
  onError?: (error: Error) => void;
}

export interface RetryEvent {
  attempt: number;
  maxAttempts: number;
  error?: Error;
  response?: Response;
  request: Request;
}

export interface FetchOptions {
  baseUrl?: string;
  timeout?: number;
  retry?: RetryOptions | number;
  defaultHeaders?: Record<string, string>;
  onRetry?: (event: RetryEvent) => void;
  onRequest?: Interceptors['onRequest'];
  onResponse?: Interceptors['onResponse'];
  onError?: Interceptors['onError'];
  fetch?: typeof fetch;
}
