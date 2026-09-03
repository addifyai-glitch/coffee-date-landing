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

  const recipientLabel = invite.recipient_name || invite.recipient_email;
  const recipientFirstName = recipientLabel.split(' ')[0];

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
    attendees: [
      { name: invite.sender_name, email: invite.sender_email, rsvp: true, partstat: 'ACCEPTED' },
      { name: recipientLabel, email: invite.recipient_email, rsvp: true },
    ],
  });

  if (error) throw error;
  return value;
}
