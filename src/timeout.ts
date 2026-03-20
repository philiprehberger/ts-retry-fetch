interface TimeoutResult {
  signal: AbortSignal;
  cleanup: () => void;
}

export function createTimeoutSignal(
  ms: number,
  existingSignal?: AbortSignal | null,
): TimeoutResult {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('The operation was aborted.', 'AbortError')), ms);

  const cleanup = () => {
    clearTimeout(timer);
  };

  if (existingSignal) {
    if (existingSignal.aborted) {
      cleanup();
      controller.abort(existingSignal.reason);
    } else {
      const onAbort = () => {
        cleanup();
        controller.abort(existingSignal.reason);
      };
      existingSignal.addEventListener('abort', onAbort, { once: true });

      const originalCleanup = cleanup;
      return {
        signal: controller.signal,
        cleanup: () => {
          originalCleanup();
          existingSignal.removeEventListener('abort', onAbort);
        },
      };
    }
  }

  return { signal: controller.signal, cleanup };
}
