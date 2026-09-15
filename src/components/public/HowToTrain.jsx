import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

// This section used to be the session-pack shop: it fetched the products
// table, priced every pack and sent people to /booking to buy credits. Packs
// are retired, so it had become a shop with nothing in it — and when the
// products table emptied it told visitors, in as many words, that "session
// packs are available from the live booking page", which was no longer true.
//
// What it is for now is the same thing it always led with: how training here
// works, and where to go to pay for it.

const steps = [
  'Pay for a casual visit, a Three Day Pass or three months upfront — or sign up for a membership.',
  'Book your sessions online.',
  'Train with expert coaching in a structured semi-private environment.',
];

export default function HowToTrain() {
  return (
    <section id="booking" className="bg-xert-ink px-6 py-14 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 grid grid-cols-1 items-start gap-8 sm:mb-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <div className="h-px w-6 bg-xert-steel" />
              <span className="font-body text-xs uppercase tracking-[0.2em] text-xert-steel">Classes, Programs, Products</span>
            </div>
            <h2 className="mb-6 font-display uppercase text-xert-offwhite" style={{ fontSize: 'clamp(2.5rem,6vw,4rem)', lineHeight: 0.95 }}>
              Simple booking.<br />
              <span className="text-xert-steel">Structured training.</span>
            </h2>
            <p className="max-w-[44ch] font-body leading-relaxed text-xert-pale/70">
              XERT operates through a booking-based system to maintain coaching quality and controlled class sizes. Initial class sizes are set to 8 people and will gradually increase as the business launches.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            {steps.map((step, i) => (
              <div key={step} className="xert-card-flat p-4 sm:p-5">
                <p className="xert-chip mb-4 tabular-nums">
                  STEP {i + 1}
                </p>
                <p className="font-body text-sm leading-relaxed text-xert-pale/75">{step}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="xert-card-flat p-5 text-center sm:p-6">
          <p className="mb-4 font-body text-sm leading-relaxed text-xert-pale/70">
            Weekly membership, a casual visit, a Three Day Pass or three months upfront — every price
            and how to start, in one place.
          </p>
          <Link to="/memberships"
            className="xert-btn-primary inline-flex min-h-[52px] items-center justify-center gap-2 px-6 font-display text-base uppercase tracking-wide">
            Memberships &amp; Passes
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
