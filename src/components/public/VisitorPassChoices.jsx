import React from 'react';
import { Link } from 'react-router-dom';
import { formatCasualVisitPrice, rememberCasualVisitor } from '@/lib/casualVisit';
import { visitorDetailsFromSignup, visitorPassChoices } from '@/lib/visitorPassChoices';

/**
 * The three ways a non-member can pay for the class they have just booked.
 *
 * Their details carry across, so nobody retypes a name and number they gave
 * thirty seconds ago on the same screen.
 */
export default function VisitorPassChoices({ settings, signup, note, onChoose }) {
  const choices = visitorPassChoices(settings);
  const visitor = visitorDetailsFromSignup(signup);
  // Standing on the page with nobody's details to carry, remembering would
  // overwrite whatever an earlier form left with a row of blanks.
  const carry = Boolean(visitor.email);

  return (
    <div className="mb-6 text-left">
      <p className="mb-3 font-body text-xs uppercase tracking-wider text-xert-pale/55">
        Choose how to pay
      </p>
      <ul className="space-y-2">
        {choices.map(choice => (
          <li key={choice.kind}>
            <Link to={choice.path}
              onClick={() => { if (carry) rememberCasualVisitor(visitor); onChoose?.(choice); }}
              className="flex min-h-[52px] items-center justify-between gap-3 border border-xert-steel/25 p-3 transition-colors hover:border-xert-steel hover:bg-xert-steel/10">
              <span className="min-w-0">
                <span className="block font-display text-sm uppercase tracking-wide text-xert-offwhite">
                  {choice.label}
                </span>
                <span className="block font-body text-xs text-xert-pale/60">{choice.blurb}</span>
              </span>
              <span className="shrink-0 text-right">
                {choice.discounted && (
                  <span className="block font-body text-xs text-xert-pale/45 line-through">
                    {formatCasualVisitPrice(choice.full)}
                  </span>
                )}
                <span className="block font-display text-sm text-xert-steel">
                  {formatCasualVisitPrice(choice.charge)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {note && (
        <p className="mt-3 font-body text-xs leading-relaxed text-xert-pale/55">{note}</p>
      )}
    </div>
  );
}
