import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('a booking decision id is never built in a default parameter', async () => {
  const source = await read('../src/lib/adminData.js');

  // The minifier lowers `globalThis.crypto?.randomUUID?.()` inside a default
  // parameter into code that calls a variable belonging to an inner arrow
  // function, which is out of scope by the time it is read:
  //
  //   n = (r => (r = (a => (a = globalThis.crypto) == null
  //        ? void 0 : a.randomUUID)()) == null ? void 0 : r.call(a))()
  //
  // That throws "Can't find variable: a" in Safari the moment the argument is
  // omitted — which it always is from the Command Centre — so confirming a
  // member booking failed every time while public sign-ups worked fine.
  assert.doesNotMatch(
    source,
    /\(\s*\w+\s*=\s*globalThis\.crypto\?\./,
    'build the request id in the function body, not in a default parameter',
  );

  // Every decision that needs one uses the shared helper.
  assert.match(source, /function newDecisionRequestID\(\) \{\s*return globalThis\.crypto\?\.randomUUID\?\.\(\);/);
  for (const fn of ['staffBookMemberIntoClass', 'adminSetBookingStatus', 'adminPromoteNextWaitlisted']) {
    const start = source.indexOf(`export async function ${fn}(`);
    assert.ok(start > 0, `${fn} exists`);
    const body = source.slice(start, start + 320);
    assert.match(body, /requestId = requestId \|\| newDecisionRequestID\(\)/, `${fn} builds its id in the body`);
  }
});

test('the exact shape the minifier used to emit really does throw', () => {
  // Kept as a live demonstration rather than a comment: if a future toolchain
  // stops producing this, the test still passes; if somebody reintroduces the
  // pattern, the check above catches it.
  const broken = new Function(
    'return function (e, t, n = (r => (r = (a => (a = globalThis.crypto) == null ? void 0 : a.randomUUID)()) == null ? void 0 : r.call(a))()) { return n; }',
  )();
  assert.throws(() => broken('booking', 'confirmed'), ReferenceError);
  // Passing an id skips the default, which is why some actions still worked.
  assert.equal(broken('booking', 'confirmed', 'given-id'), 'given-id');
});
