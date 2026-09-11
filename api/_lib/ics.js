/* ==========================================================================
   .ics generation for a confirmed coffee invite. One file is generated per
   invite and attached to BOTH parties' confirmation emails — same bytes to
   each. Duration is fixed at 60 minutes.
   ========================================================================== */

import { createEvent } from 'ics';

export function buildInviteIcs(invite) {
  const start = new Date(invite.starts_at);
  const dateArray = [
    start.getUTCFullYear(),
    start.getUTCMonth() + 1,
    start.getUTCDate(),
    start.getUTCHours(),
    start.getUTCMinutes(),
  ];

  // recipient_email is nullable (invites shared via WhatsApp/link rather
  // than emailed) — fall back to a generic label, and only add a second
  // attendee entry when there's an actual email for it (the `ics` library
  // expects a real address there, not null/undefined).
  const recipientLabel = invite.recipient_name || invite.recipient_email || 'your guest';
  const recipientFirstName = recipientLabel.split(' ')[0];

  const attendees = [{ name: invite.sender_name, email: invite.sender_email, rsvp: true, partstat: 'ACCEPTED' }];
  if (invite.recipient_email) {
    attendees.push({ name: recipientLabel, email: invite.recipient_email, rsvp: true });
  }

  const { error, value } = createEvent({
    uid: `invite-${invite.id}@pookie.addify.ae`,
    method: 'REQUEST',
    productId: 'Pookie',
    title: `Coffee with ${recipientFirstName}`,
    start: dateArray,
    startInputType: 'utc',
    startOutputType: 'utc',
    duration: { minutes: 60 },
    location: invite.place,
    description: `${invite.message ? `${invite.message}\n\n` : ''}Arranged via Pookie`,
    organizer: { name: invite.sender_name, email: invite.sender_email },
    attendees,
  });

  if (error) throw error;
  return value;
}
