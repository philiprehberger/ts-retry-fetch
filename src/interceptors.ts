import type { Interceptors } from './types.js';

export async function applyRequestInterceptor(
  request: Request,
  interceptor?: Interceptors['onRequest'],
): Promise<Request> {
  if (!interceptor) return request;
  return interceptor(request);
}

export async function applyResponseInterceptor(
  response: Response,
  interceptor?: Interceptors['onResponse'],
): Promise<Response> {
  if (!interceptor) return response;
  return interceptor(response);
}
