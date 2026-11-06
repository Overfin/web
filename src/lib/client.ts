// The SDK, set up once for the whole site, and errors in words.
import { Overfin, OverfinError } from './sdk/overfin.js';
import { has, t } from './i18n.svelte';

// Signing out (leave), the page's requests still on their way come back
// "not signed in": they don't send the browser to sign in again.
let leaving = false;

export const overfin = new Overfin({
  onLoginRequired: (url) => {
    if (!leaving) location.href = url;
  },
});
export { OverfinError };

/** leave says the person is signing out: see overfin above. */
export function leave() {
  leaving = true;
}

/** hls loads hls.js, for browsers without native HLS, only once something plays. */
export async function hls(): Promise<unknown> {
  return (await import('hls.js')).default;
}

/** explain turns an error into a sentence for the person. */
export function explain(err: unknown): string {
  if (!(err instanceof OverfinError)) return t('error.generic');
  // A PIN lock that ends by itself says when, in minutes; one that doesn't
  // waits for the account owner.
  if (err.type === 'pin-locked' && err.retryAfter) return t('error.pin-lockedFor', { minutes: Math.ceil(err.retryAfter / 60) });
  const key = `error.${err.type}`;
  const message = has(key) ? t(key) : t('error.generic');
  return err.retryAfter ? t('error.retryAfter', { message, seconds: err.retryAfter }) : message;
}

/** isError reports whether err is an API error of the given type. */
export function isError(err: unknown, type: string): err is OverfinError {
  return err instanceof OverfinError && err.type === type;
}
