const FOLLOW_UP_CHANNELS = new Set(['email', 'phone', 'sms', 'in_person']);

const REASON_LABELS = {
  no_first_booking: 'first class booking',
  credits_expiring: 'booking their next class',
  idle_credits: 'booking their next class',
  renewal_due: 'training renewal',
  setup_incomplete: 'member setup',
  readiness_incomplete: 'current member readiness',
  no_training_access: 'choosing a membership or pass',
  no_first_attendance: 'first-class support',
};

function firstName(member) {
  return String(member?.full_name || '').trim().split(/\s+/)[0] || 'there';
}

function bookingUrl(baseUrl) {
  try {
    return new URL('/booking', baseUrl).toString();
  } catch {
    return '/booking';
  }
}

/** Where somebody is sent to start paying, now that packs are retired. */
function membershipUrl(baseUrl) {
  try {
    return new URL('/memberships', baseUrl).toString();
  } catch {
    return '/memberships';
  }
}

export function createFollowUpCopy(member, baseUrl) {
  const name = firstName(member);
  const bookLink = bookingUrl(baseUrl);
  const membershipLink = membershipUrl(baseUrl);
  let subject = 'Your next XERT class';
  let message = `We would love to help you keep your training moving. You can view the timetable and book here: ${bookLink}`;

  if (member?.reason === 'no_first_booking') {
    subject = 'Ready for your first XERT class?';
    message = `We would love to help you book your first XERT class. You can view the timetable and choose a session here: ${bookLink}`;
  } else if (member?.reason === 'setup_incomplete' || member?.reason === 'readiness_incomplete') {
    subject = 'Complete your XERT member setup';
    const readinessLink = (() => {
      try { return new URL('/account#member-readiness', baseUrl).toString(); } catch { return '/account#member-readiness'; }
    })();
    message = `Your XERT member setup still has an action available. Review your current details and acknowledgements here: ${readinessLink}`;
  } else if (member?.reason === 'no_training_access') {
    subject = 'Choose your XERT training access';
    message = `Pick the membership or pass that suits you here: ${membershipLink}`;
  } else if (member?.reason === 'no_first_attendance') {
    subject = 'How can we help with your first XERT class?';
    message = `We would love to help you get your first XERT class completed. Reply to this message if you need support, or choose another session here: ${bookLink}`;
  } else if (member?.reason === 'credits_expiring' || member?.reason === 'idle_credits') {
    // These two chased people about a balance they can no longer spend: class
    // credits are retired, so nothing redeems one. The nudge to come back in
    // is still worth sending — the reason for it is not.
    subject = 'Ready for your next XERT class?';
    message = `You can view the timetable and book your next class here: ${bookLink}`;
  } else if (member?.reason === 'renewal_due') {
    subject = 'Keep your XERT training moving';
    message = `Ready for your next training block? The current memberships and passes are here: ${membershipLink}`;
  }

  const emailBody = `Hi ${name},\n\n${message}\n\nTrain for Life. Compete for Fun.\nXERT Fitness`;
  return {
    subject,
    emailBody,
    mailto: `mailto:${encodeURIComponent(String(member?.email || '').trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`,
  };
}

export function createFollowUpLog(member, channel, note = '') {
  const normalizedChannel = String(channel || '').trim().toLowerCase();
  if (!FOLLOW_UP_CHANNELS.has(normalizedChannel)) {
    throw new Error('Choose how the member was contacted.');
  }
  const normalizedNote = String(note || '').trim().replace(/\s+/g, ' ');
  if (normalizedNote.length > 500) {
    throw new Error('Follow-up context must be 500 characters or fewer.');
  }
  const channelLabel = normalizedChannel === 'in_person'
    ? 'in person'
    : normalizedChannel.toUpperCase() === 'SMS' ? 'SMS' : normalizedChannel;
  const reason = REASON_LABELS[member?.reason] || 'member follow-up';
  return `Contacted via ${channelLabel} about ${reason}.${normalizedNote ? ` ${normalizedNote}` : ''}`;
}
