import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  CONTRACTOR_ACCEPT_OPTION, CONTRACTOR_DECLINE_OPTION,
  XERT_CONTRACTOR_FORM_DEFINITION as definition, validateXertContractorFormDefinition,
} from '../src/lib/xertContractorForm.js';
import {
  XERT_CONTRACTOR_QUALIFICATIONS, XERT_CONTRACTOR_SECTIONS, XERT_CONTRACTOR_SERVICES,
  contractorSectionText,
} from '../src/lib/xertContractorAgreement.js';

const byId = id => definition.questions.find(question => question.id === id);

test('the agreement is a valid form the platform will accept', () => {
  assert.equal(validateXertContractorFormDefinition(), null);
  assert.equal(definition.slug, 'contractor-agreement');
  assert.equal(definition.form_type, 'waiver');
  const ids = definition.questions.map(question => question.id);
  assert.equal(new Set(ids).size, ids.length, 'a duplicate id would orphan a signed agreement');
  assert.ok(definition.questions.length <= 100, 'the platform caps a form at 100 fields');
});

test('every blank on the paper agreement is a field here', () => {
  // The paper has a ruled line per detail; each is its own field so a signed
  // record reads back the way the agreement does.
  for (const [id, type] of [
    ['ic-01-name', 'name_fields'], ['ic-02-address', 'address'], ['ic-03-abn', 'short_text'],
    ['ic-04-business-name', 'short_text'], ['ic-05-phone', 'phone'], ['ic-06-email', 'email'],
    ['ic-92-contractor-name', 'short_text'], ['ic-94-commencement', 'date'],
  ]) {
    const question = byId(id);
    assert.ok(question, `${id} is missing`);
    assert.equal(question.type, type, id);
  }
  // Only the trading name is optional; a contractor may not have one.
  assert.equal(byId('ic-04-business-name').required, false);
  for (const id of ['ic-01-name', 'ic-02-address', 'ic-03-abn', 'ic-05-phone', 'ic-06-email']) {
    assert.equal(byId(id).required, true, `${id} must be required`);
  }
});

test('the tick boxes are real tick boxes, and the service choice is one of three', () => {
  const quals = byId('ic-08-qualifications');
  assert.equal(quals.type, 'multiple_choice', 'the paper has six independent boxes');
  assert.deepEqual(quals.options, [...XERT_CONTRACTOR_QUALIFICATIONS]);
  assert.equal(quals.options.length, 6);
  assert.equal(quals.required, true);

  const service = byId('ic-09-service');
  assert.equal(service.type, 'single_choice', 'the paper offers one of three');
  assert.deepEqual(service.options, [...XERT_CONTRACTOR_SERVICES]);
  assert.equal(service.required, true);
});

test('both signatures are captured, and declining skips them', () => {
  const contractor = byId('ic-93-contractor-signature');
  const owner = byId('ic-98-owner-signature');
  assert.equal(contractor.type, 'signature');
  assert.equal(contractor.required, true);
  // The paper is countersigned at the desk. Keeping both on one record is what
  // makes the exported PDF the whole document rather than half of it.
  assert.equal(owner.type, 'signature');
  assert.equal(owner.required, false, 'the owner signs after the contractor does');

  const accept = byId('ic-91-accept');
  assert.deepEqual(accept.options, [CONTRACTOR_ACCEPT_OPTION, CONTRACTOR_DECLINE_OPTION]);
  assert.deepEqual(accept.skip_rules, [
    { option: CONTRACTOR_DECLINE_OPTION, skip_to: definition.questions.length + 1 },
  ], 'declining ends the form rather than asking for a signature');
});

test('the whole agreement is carried, not summarised', () => {
  assert.equal(XERT_CONTRACTOR_SECTIONS.length, 12);
  const clauses = XERT_CONTRACTOR_SECTIONS.reduce((n, s) => n + s.points.length, 0);
  assert.ok(clauses >= 60, `only ${clauses} clauses carried across`);
  for (const item of XERT_CONTRACTOR_SECTIONS) {
    assert.ok(definition.questions.some(question => question.id === item.id), `${item.title} missing`);
    assert.ok(definition.questions.some(question => question.id === `${item.id}-text`), `${item.title} body missing`);
    assert.ok(contractorSectionText(item).length > 80);
  }
  // Clauses that make the document enforceable must survive transcription.
  const all = XERT_CONTRACTOR_SECTIONS.flatMap(section => section.points).join(' ');
  for (const phrase of [
    'indemnifies and holds harmless', 'not liable to the extent',
    'two weeks’ notice', 'serious misconduct', 'Privacy Act 1988',
  ]) assert.ok(all.includes(phrase), `missing clause wording: ${phrase}`);
});

test('a signed copy is emailed, and the record prints as a document', async () => {
  assert.equal(definition.email_copy_to_respondent, true, 'the signer keeps a copy');
  assert.equal(definition.collect_email_required, true, 'or there is nowhere to send it');

  // The printable record is what "output to a clean PDF" rests on: it waits
  // for the signature images to decode before printing, so a PDF can never be
  // saved with an empty signature box.
  const record = await readFile(
    new URL('../src/components/admin/FormResponseRecord.jsx', import.meta.url), 'utf8');
  assert.match(record, /await waitForPrintableImages\(recordRef\.current\);\s*window\.print\(\)/);
  assert.match(record, /Print \/ Save PDF/);
  assert.match(record, /xert-response-print-record/);
});

test('the business type sits with the business name and is optional', () => {
  const type = byId('ic-04b-business-type');
  assert.ok(type, 'the Pty Ltd / Ltd question is missing');
  assert.equal(type.type, 'single_choice');
  assert.deepEqual(type.options, ['Pty Ltd', 'Ltd']);
  // A sole trader has neither, so requiring an answer would block them.
  assert.equal(type.required, false);
  const ids = definition.questions.map(question => question.id);
  assert.equal(ids.indexOf('ic-04b-business-type'), ids.indexOf('ic-04-business-name') + 1,
    'it belongs directly under the business name it describes');
});
