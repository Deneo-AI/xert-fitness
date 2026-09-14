import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  applyRelease, reloadOnceOnControllerChange, SKIP_WAITING_MESSAGE,
  waitingRelease, watchForRelease,
} from '../src/lib/appUpdates.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

function fakeTarget() {
  const listeners = new Map();
  return {
    visibilityState: 'visible',
    addEventListener: (type, fn) => listeners.set(type, [...(listeners.get(type) || []), fn]),
    removeEventListener: (type, fn) => listeners.set(type, (listeners.get(type) || []).filter(f => f !== fn)),
    emit: (type, event) => (listeners.get(type) || []).forEach(fn => fn(event)),
    count: type => (listeners.get(type) || []).length,
  };
}

test('a release is only offered once it is installed and has something to replace', () => {
  assert.equal(waitingRelease(null), null);
  // A first ever visit installs with nothing to replace — offering "a new
  // version is ready" to somebody who just opened the app would be nonsense.
  assert.equal(waitingRelease({ waiting: { id: 'w' }, active: null }), null);
  assert.equal(waitingRelease({ waiting: null, active: { id: 'a' } }), null);
  assert.deepEqual(waitingRelease({ waiting: { id: 'w' }, active: { id: 'a' } }), { id: 'w' });
});

test('a release that installed while the app was closed is announced straight away', () => {
  const registration = { ...fakeTarget(), waiting: { id: 'w' }, active: { id: 'a' }, update: () => Promise.resolve() };
  const seen = [];
  const stop = watchForRelease(registration, release => seen.push(release), {
    target: fakeTarget(), setTimer: () => 1, clearTimer: () => {},
  });
  assert.deepEqual(seen, [{ id: 'w' }]);
  stop();
});

test('a release that installs while somebody is working is announced when it finishes', () => {
  const installing = fakeTarget();
  const registration = { ...fakeTarget(), waiting: null, active: { id: 'a' }, installing, update: () => Promise.resolve() };
  const seen = [];
  const stop = watchForRelease(registration, release => seen.push(release), {
    target: fakeTarget(), setTimer: () => 1, clearTimer: () => {},
  });
  assert.deepEqual(seen, [], 'nothing to say yet');

  registration.emit('updatefound');
  // Still installing: announcing now would offer a release that cannot be taken.
  installing.state = 'installing';
  installing.emit('statechange');
  assert.deepEqual(seen, []);

  installing.state = 'installed';
  registration.waiting = { id: 'next' };
  installing.emit('statechange');
  assert.deepEqual(seen, [{ id: 'next' }]);
  stop();
});

test('a phone app that is resumed rather than reloaded still checks', () => {
  const target = fakeTarget();
  let checks = 0;
  const registration = {
    ...fakeTarget(), waiting: null, active: { id: 'a' },
    update: () => { checks += 1; return Promise.resolve(); },
  };
  const seen = [];
  const stop = watchForRelease(registration, release => seen.push(release), {
    target, setTimer: () => 1, clearTimer: () => {},
  });

  registration.waiting = { id: 'next' };
  target.emit('visibilitychange');
  assert.equal(checks, 1, 'coming back to the app looks for a new release');
  assert.deepEqual(seen, [{ id: 'next' }]);

  // Going away does not.
  target.visibilityState = 'hidden';
  target.emit('visibilitychange');
  assert.equal(checks, 1);

  stop();
  assert.equal(target.count('visibilitychange'), 0, 'unmounting stops listening');
});

test('taking the update asks the waiting worker to take over, and never reloads twice', () => {
  const posted = [];
  assert.equal(applyRelease({ postMessage: message => posted.push(message) }), true);
  assert.deepEqual(posted, [{ type: SKIP_WAITING_MESSAGE }]);
  assert.equal(applyRelease(null), false, 'nothing waiting is not an error');
  assert.equal(applyRelease({ postMessage: () => { throw new Error('gone'); } }), false);

  // controllerchange can fire more than once; a second reload is a loop.
  const container = fakeTarget();
  let reloads = 0;
  const stop = reloadOnceOnControllerChange(container, () => { reloads += 1; });
  container.emit('controllerchange');
  container.emit('controllerchange');
  assert.equal(reloads, 1);
  stop();
});

test('the worker waits for the page to ask, and the page offers rather than forces', async () => {
  const worker = await read('../public/sw.js');
  const prompt = await read('../src/components/public/AppUpdatePrompt.jsx');
  const app = await read('../src/App.jsx');

  // The worker only steps forward when asked, so a release never swaps the
  // cache under a session that is mid-job.
  assert.match(worker, /addEventListener\('message'/);
  assert.match(worker, /XERT_SKIP_WAITING'\) self\.skipWaiting\(\)/);
  assert.doesNotMatch(worker.split("addEventListener('message'")[0], /skipWaiting/,
    'installing must not take over on its own');

  assert.match(prompt, /Update available/);
  assert.match(prompt, /Not now/, 'it can be put off');
  assert.match(prompt, /finish what you are doing first/);
  assert.match(prompt, /aria-live="polite"/);
  assert.match(app, /<AppUpdatePrompt \/>/);
});
