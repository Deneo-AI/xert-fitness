// ─── "Already provided" ─────────────────────────────────────────────────────
// Some forms ask for details the club already holds, or that the respondent
// gave a few questions earlier. A field can offer an "Already provided" tick
// so nobody has to type their email or phone a second time.
//
// Ticking it records the answer as the plain text below. That is deliberate:
// it reads correctly everywhere an answer is shown -- the admin record, the
// CSV export, the emailed copy and the PDF -- without any of them needing to
// know the feature exists. The database accepts it in place of a formatted
// email only when the field has the option switched on, so it cannot be used
// to slip a non-email past a field that does not offer it.

export const ALREADY_PROVIDED_ANSWER = 'Already provided';

// Only fields whose answer is a single piece of text. A name or address is
// several parts, a number is a number, and a choice is already a tick box.
export const ALREADY_PROVIDED_TYPES = new Set([
  'short_text', 'long_text', 'email', 'phone', 'url', 'date', 'time', 'datetime',
]);

/** Whether a field of this type can carry the option at all. */
export function canOfferAlreadyProvided(question) {
  return ALREADY_PROVIDED_TYPES.has(String(question?.type || ''));
}

/** Whether this field has the option switched on. */
export function offersAlreadyProvided(question) {
  return canOfferAlreadyProvided(question) && question.allow_already_provided === true;
}

/** Whether this answer is the tick rather than a typed value. */
export function isAlreadyProvided(question, value) {
  return offersAlreadyProvided(question) && value === ALREADY_PROVIDED_ANSWER;
}
