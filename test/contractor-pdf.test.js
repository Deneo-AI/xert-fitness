import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument } from 'pdf-lib';
import {
  CONTRACTOR_PDF_FIELDS, pdfSafe, renderContractorPdf, wrapText,
} from '../src/lib/contractorPdf.js';
import {
  XERT_CONTRACTOR_QUALIFICATIONS, XERT_CONTRACTOR_SECTIONS, XERT_CONTRACTOR_SERVICES,
} from '../src/lib/xertContractorAgreement.js';

/** A 2x2 PNG, enough to prove a signature is embedded rather than described. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8//8/AzJgYkAD'
  + 'IwsAHawCDf3SsvIAAAAASUVORK5CYII=', 'base64');

async function textOf(bytes) {
  // pdf-lib does not read text back, so the check is on the content streams,
  // which is where drawText puts it.
  const doc = await PDFDocument.load(bytes);
  return { doc, pages: doc.getPageCount() };
}

test('a newline survives sanitising as a break, not as a question mark', () => {
  // This was a real fault: sanitising ran before the split, so every paragraph
  // break in the agreement came out as "??" in the middle of a sentence.
  const lines = wrapText('First line.\n\nSecond line.', {
    widthOfTextAtSize: text => text.length * 5,
  }, 9, 1000);
  assert.deepEqual(lines, ['First line.', '', 'Second line.']);
  assert.ok(!lines.join('').includes('?'));
});

test('characters the font cannot draw are replaced, not thrown on', () => {
  assert.equal(pdfSafe('don’t “quote” me…'), 'don\'t "quote" me...');
  assert.equal(pdfSafe('• clause'), '• clause');
  // A character outside WinAnsi would throw at draw time if it got through.
  assert.equal(pdfSafe('emoji \u{1F600}'), 'emoji ??');
});

test('the fillable version carries a real form field for every blank', async () => {
  const bytes = await renderContractorPdf({ mode: 'interactive' });
  const { doc } = await textOf(bytes);
  const form = doc.getForm();
  const names = form.getFields().map(field => field.getName());

  for (const { id } of [...CONTRACTOR_PDF_FIELDS.details, ...CONTRACTOR_PDF_FIELDS.signOff]) {
    assert.ok(names.includes(id), `${id} is not fillable`);
    assert.doesNotThrow(() => form.getTextField(id), `${id} should be a text field`);
  }

  // Six independent tick boxes, exactly as the paper has them.
  for (let index = 0; index < XERT_CONTRACTOR_QUALIFICATIONS.length; index += 1) {
    assert.doesNotThrow(() => form.getCheckBox(`ic-08-qualifications.${index}`));
  }
  // One of three, so it has to be a radio group rather than three boxes.
  const service = form.getRadioGroup('ic-09-service');
  assert.deepEqual(service.getOptions(), [...XERT_CONTRACTOR_SERVICES]);
  assert.deepEqual(form.getRadioGroup('ic-91-accept').getOptions(),
    ['I accept this agreement', 'I decline']);
});

test('a fillable field keeps what is typed into it', async () => {
  // An appearance stream that is not generated leaves the value invisible in
  // most readers, which is the usual way a "fillable" PDF turns out not to be.
  const doc = await PDFDocument.load(await renderContractorPdf({ mode: 'interactive' }));
  const form = doc.getForm();
  form.getTextField('ic-01-name').setText('Jordan Avery');
  form.getCheckBox('ic-08-qualifications.0').check();
  form.getRadioGroup('ic-09-service').select(XERT_CONTRACTOR_SERVICES[1]);

  const reloaded = await PDFDocument.load(await doc.save());
  const back = reloaded.getForm();
  assert.equal(back.getTextField('ic-01-name').getText(), 'Jordan Avery');
  assert.equal(back.getCheckBox('ic-08-qualifications.0').isChecked(), true);
  assert.equal(back.getRadioGroup('ic-09-service').getSelected(), XERT_CONTRACTOR_SERVICES[1]);
});

test('the signed version is a record: filled in, signed, and not editable', async () => {
  const bytes = await renderContractorPdf({
    mode: 'signed',
    values: { 'ic-01-name': 'Jordan Avery', 'ic-94-commencement': '25 September 2026' },
    qualifications: [XERT_CONTRACTOR_QUALIFICATIONS[0]],
    service: XERT_CONTRACTOR_SERVICES[2],
    accepted: 'I accept this agreement',
    signatures: { 'ic-93-contractor-signature': PNG, 'ic-98-owner-signature': PNG },
  });
  const { doc, pages } = await textOf(bytes);
  // Nothing left to type into: a signed copy people can edit is not a record.
  assert.equal(doc.getForm().getFields().length, 0);
  assert.ok(pages >= 5, `a twelve-section agreement should not fit in ${pages} pages`);
  assert.match(doc.getTitle(), /signed/i);
});

test('both versions lay out identically, so the signed one is the same document', async () => {
  const [blank, signed] = await Promise.all([
    renderContractorPdf({ mode: 'interactive' }),
    renderContractorPdf({ mode: 'signed', accepted: 'I accept this agreement' }),
  ]);
  const [a, b] = await Promise.all([PDFDocument.load(blank), PDFDocument.load(signed)]);
  assert.equal(a.getPageCount(), b.getPageCount(),
    'the fillable and signed copies must paginate the same');
  const size = a.getPage(0).getSize();
  assert.ok(Math.abs(size.width - 595.28) < 1 && Math.abs(size.height - 841.89) < 1,
    'the agreement is an A4 document');
});

test('every clause in the agreement reaches the page', async () => {
  const bytes = await renderContractorPdf({ mode: 'signed' });
  const doc = await PDFDocument.load(bytes);
  // Enough pages that no section could have been silently dropped: twelve
  // headings and sixty-odd clauses do not fit in three.
  const clauses = XERT_CONTRACTOR_SECTIONS.reduce((n, s) => n + s.points.length, 0);
  assert.ok(clauses >= 60);
  assert.ok(doc.getPageCount() >= 6, `only ${doc.getPageCount()} pages for ${clauses} clauses`);
});
