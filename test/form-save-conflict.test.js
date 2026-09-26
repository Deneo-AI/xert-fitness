import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = name => readFile(new URL(name, import.meta.url), 'utf8');

test('a save that matches no row does not surface as a coercion error', async () => {
  const source = await read('../src/lib/xertForms.js');
  // .single() on a conditional update turns "somebody else got there first"
  // into "Cannot coerce the result to a single JSON object", which told an
  // admin nothing and looked like the form builder was broken.
  const update = source.slice(source.indexOf('export async function saveOwnerForm'));
  const body = update.slice(0, update.indexOf('\n}\n'));
  assert.ok(body.includes(".eq('updated_at', form.updated_at).select('*').maybeSingle()"),
    'the conditional update must use maybeSingle');
  assert.ok(!/\.eq\('updated_at'[^\n]*\.single\(\)/.test(body),
    'the conditional update must not use single()');
});

test('the conflict is reported as a conflict, and tells the two cases apart', async () => {
  const source = await read('../src/lib/xertForms.js');
  assert.match(source, /export const FORM_CHANGED_ELSEWHERE/);
  assert.match(source, /export const FORM_DELETED_ELSEWHERE/);
  // Reopening a form only helps when there is still a form there.
  assert.match(source, /conflict\.code = current \? FORM_CHANGED_ELSEWHERE : FORM_DELETED_ELSEWHERE/);
  assert.match(source, /changed somewhere else after you opened it/);
});

test('the provider code survives the error wrapper', async () => {
  const source = await read('../src/lib/xertForms.js');
  const fn = source.slice(source.indexOf('function throwIfError'));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  // The editor now branches on err.code, so dropping it would silently
  // reinstate the original bug.
  assert.match(body, /wrapped\.code = error\.code/);
  assert.match(body, /wrapped\.details = error\.details/);
});

test('the editor offers a way out of a stale save instead of a dead end', async () => {
  const manager = await read('../src/components/admin/FormsSurveysManager.jsx');
  assert.match(manager, /FORM_CHANGED_ELSEWHERE/);
  assert.match(manager, /setStaleFormID\(err\.code === FORM_CHANGED_ELSEWHERE \? draft\.id : null\)/);
  assert.match(manager, /Reload the latest version/);
  // A fresh attempt must clear the previous verdict, or the button lingers
  // after a save that has since succeeded.
  assert.match(manager, /setSaving\(true\); setStaleFormID\(null\);/);
});
