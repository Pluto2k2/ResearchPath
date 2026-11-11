import { UpstreamError } from './errors.js';

export const UPSTREAM_TIMEOUT_MS = 10000;

function isTimeout(err) {
  return err?.name === 'TimeoutError' || err?.name === 'AbortError';
}

// Messages are passed in so the caller decides what the student sees; the URL and
// the upstream body never end up in an error.
export async function requestUpstream(fetch, url, { timeoutMessage, failMessage, accept }) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      headers: { Accept: accept, 'User-Agent': 'ResearchPath/0.2.0' },
    });
    if (!response.ok) {
      throw new UpstreamError(failMessage);
    }
    return await response.text();
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    throw new UpstreamError(isTimeout(err) ? timeoutMessage : failMessage);
  }
}
