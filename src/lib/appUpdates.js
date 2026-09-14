// ─── Telling somebody a new version is ready ────────────────────────────────
// The service worker deliberately does not take over the moment it installs:
// swapping the cache under a running session can pair an old lazy-loaded
// screen with a new release and break it in ways nobody can explain. So a new
// build installs and then waits.
//
// The cost of that safety was that it waited for every tab to close, which on
// an installed phone app can be days — a fix could be deployed and the person
// who reported the bug would still be running the broken build. These let the
// app notice a waiting release and offer it, so taking the update is a choice
// somebody makes between jobs rather than something that happens under them.

export const SKIP_WAITING_MESSAGE = 'XERT_SKIP_WAITING';

/** How often a long-lived session looks for a new release. */
export const UPDATE_POLL_INTERVAL_MS = 15 * 60 * 1000;

/**
 * The worker that has installed and is waiting to take over, or null.
 *
 * `active` has to be there too: on a first ever visit the worker installs with
 * nothing to replace, and offering "a new version is ready" to somebody who
 * just opened the app for the first time would be nonsense.
 */
export function waitingRelease(registration) {
  if (!registration || !registration.waiting || !registration.active) return null;
  return registration.waiting;
}

/**
 * Watches one registration and calls `onReady` when a release is waiting.
 * Returns a function that stops watching.
 *
 * Checks on a timer and whenever the app is brought back to the foreground,
 * because a phone app is usually resumed rather than reloaded.
 */
export function watchForRelease(registration, onReady, {
  interval = UPDATE_POLL_INTERVAL_MS,
  target = typeof document === 'undefined' ? null : document,
  setTimer = (fn, ms) => setInterval(fn, ms),
  clearTimer = id => clearInterval(id),
} = {}) {
  if (!registration) return () => {};

  const announce = () => {
    const waiting = waitingRelease(registration);
    if (waiting) onReady(waiting);
  };

  // A release that installed while the app was closed is already waiting.
  announce();

  const onUpdateFound = () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed') announce();
    });
  };
  registration.addEventListener?.('updatefound', onUpdateFound);

  const check = () => { void registration.update?.()?.catch?.(() => {}); };
  const timer = setTimer(check, interval);

  const onVisible = () => {
    if (target?.visibilityState === 'visible') { check(); announce(); }
  };
  target?.addEventListener?.('visibilitychange', onVisible);

  return () => {
    registration.removeEventListener?.('updatefound', onUpdateFound);
    target?.removeEventListener?.('visibilitychange', onVisible);
    clearTimer(timer);
  };
}

/**
 * Takes the waiting release. The page reloads once the new worker takes over,
 * which the caller arranges through a `controllerchange` listener — reloading
 * straight away would race the swap and reload the old build again.
 */
export function applyRelease(waiting, { message = SKIP_WAITING_MESSAGE } = {}) {
  if (!waiting) return false;
  try {
    waiting.postMessage({ type: message });
    return true;
  } catch {
    return false;
  }
}

/**
 * Reloads when the new worker takes over, and only once: `controllerchange`
 * can fire more than once, and a second reload would put somebody in a loop.
 */
export function reloadOnceOnControllerChange(container, reload) {
  let reloaded = false;
  const onChange = () => {
    if (reloaded) return;
    reloaded = true;
    reload();
  };
  container?.addEventListener?.('controllerchange', onChange);
  return () => container?.removeEventListener?.('controllerchange', onChange);
}
