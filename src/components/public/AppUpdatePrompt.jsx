import React, { useCallback, useEffect, useState } from 'react';
import { ArrowUpCircle, X } from 'lucide-react';
import {
  applyRelease, reloadOnceOnControllerChange, watchForRelease,
} from '@/lib/appUpdates';

/**
 * Offers a waiting release rather than installing it under somebody mid-job.
 *
 * The service worker will not take over on its own — a release that swapped
 * itself in could pair an old lazy-loaded screen with a new cache. That safety
 * used to mean waiting for every tab to close, so on an installed phone app a
 * fix could be deployed and the person who reported the bug would still be
 * running the broken build. This tells them it is there and lets them take it.
 */
export default function AppUpdatePrompt() {
  const [waiting, setWaiting] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    let stopWatching = () => {};
    let active = true;

    navigator.serviceWorker.ready.then(registration => {
      if (!active) return;
      stopWatching = watchForRelease(registration, release => {
        setWaiting(release);
        // A release that arrives after somebody dismissed an older one is
        // worth mentioning again.
        setDismissed(false);
      });
    }).catch(() => {});

    const stopReloading = reloadOnceOnControllerChange(
      navigator.serviceWorker,
      () => window.location.reload(),
    );

    return () => { active = false; stopWatching(); stopReloading(); };
  }, []);

  const update = useCallback(() => {
    setUpdating(true);
    // The reload happens when the new worker takes over, not here: reloading
    // now would race the swap and load the old build again.
    if (!applyRelease(waiting)) window.location.reload();
  }, [waiting]);

  if (!waiting || dismissed) return null;

  return (
    <div role="status" aria-live="polite"
      className="fixed inset-x-3 z-50 sm:left-auto sm:right-4 sm:w-[22rem]"
      style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
      <div className="xert-glass xert-float flex items-start gap-3 rounded-2xl p-4">
        <ArrowUpCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-xert-steel" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm uppercase tracking-wide text-xert-offwhite">Update available</p>
          <p className="mt-1 font-body text-xs leading-relaxed text-xert-pale/70">
            A newer version of XERT is ready. Updating reloads the page, so finish what you are doing first.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={update} disabled={updating}
              className="inline-flex min-h-11 items-center justify-center bg-xert-steel px-4 font-display text-xs uppercase tracking-wide text-xert-navy transition-colors hover:bg-xert-pale disabled:opacity-60">
              {updating ? 'Updating…' : 'Update now'}
            </button>
            <button type="button" onClick={() => setDismissed(true)}
              className="inline-flex min-h-11 items-center justify-center border border-xert-steel/30 px-4 font-body text-xs text-xert-pale/70 transition-colors hover:border-xert-steel/60 hover:text-xert-offwhite">
              Not now
            </button>
          </div>
        </div>
        <button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss the update notice"
          className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center text-xert-pale/50 transition-colors hover:text-xert-offwhite">
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
