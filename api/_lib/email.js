/* ==========================================================================
   Resend, server-side only. Every template shares one plain HTML wrapper
   styled with the café palette (§9), with a text fallback and no tracking
   pixels. Every send logs { template, to (masked), resend_id } so Vercel
   logs double as an audit trail.
   ========================================================================== */

import { Resend } from 'resend';

let resendClient = null;

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error('RESEND_API_KEY missing from environment');
    const err = new Error('Server is not configured');
    err.status = 500;
    throw err;
  }
  if (!resendClient) resendClient = new Resend(key);
  return resendClient;
}

const siteUrl = () => process.env.SITE_URL || 'https://pookie.addify.ae';

const maskEmail = (email) => {
  if (!email) return '';
  const [user, domain] = String(email).split('@');
  if (!domain) return '***';
  return `${user.slice(0, 2)}***@${domain}`;
};

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

function formatDateTime(isoString, timezone) {
  try {
    // hour12: false is explicit, not just relying on en-GB's default —
    // 24-hour time everywhere, guaranteed, not locale-dependent.
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: timezone || 'Europe/Vienna',
      hour12: false,
    }).format(new Date(isoString));
  } catch {
    return new Date(isoString).toISOString();
  }
}

function toText(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Matches the live site's actual pink/purple theme and 💗 heart logo
// (style.css --color-cloud/--color-ink/--color-rose, common.js buildNav) —
// this used to be the leftover espresso/cream "café" look from an earlier
// design phase, which no longer matched the product at all. Colors are
// solid (no gradients/backdrop-filter) since email clients render those
// unreliably.
function wrapHtml({ preheader = '', heading, bodyHtml, ctaText, ctaHref, brand = 'Pookie &#128151;' }) {
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#FDF1F5;font-family:'Poppins','Segoe UI',Arial,sans-serif;color:#241B2E;">
  <span style="display:none;opacity:0;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FDF1F5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:20px;overflow:hidden;">
        <tr><td style="background:#241B2E;padding:24px 32px;">
          <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.02em;">${brand}</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:22px;color:#241B2E;">${heading}</h1>
          <div style="font-size:15px;line-height:1.6;color:#4a4256;">${bodyHtml}</div>
          ${ctaText && ctaHref ? `<p style="margin:28px 0 0;"><a href="${ctaHref}" style="display:inline-block;background:#FF6F91;color:#241B2E;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:700;">${escapeHtml(ctaText)}</a></p>` : ''}
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #f0e6ec;">
          <p style="margin:0;font-size:12px;color:#8a7f92;">Sent by Pookie — the platform, not a person. If this wasn't you, you can safely ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function send({ to, subject, html, attachments }) {
  const resend = getResend();
  const from = process.env.FROM_EMAIL;
  const replyTo = process.env.REPLY_TO;
  if (!from) {
    console.error('FROM_EMAIL missing from environment');
    const err = new Error('Server is not configured');
    err.status = 500;
    throw err;
  }
  const { data, error } = await resend.emails.send({
    from, to, subject, html, text: toText(html), reply_to: replyTo, attachments,
  });
  if (error) throw new Error(error.message || 'Resend send failed');
  return data;
}

function logSend(template, to, id) {
  console.log(JSON.stringify({ template, to: maskEmail(to), resend_id: id }));
}

// For a Promise.allSettled pair: logs each outcome independently so one
// party's failure is visible in Vercel logs without ever throwing — a
// failed send here must never turn an already-successful accept/decline
// into a 500 for the user, and must never suppress the other party's send.
function logSendResult(template, to, result) {
  if (result.status === 'fulfilled') {
    logSend(template, to, result.value?.id);
  } else {
    console.error(JSON.stringify({ template, to: maskEmail(to), error: result.reason?.message || String(result.reason) }));
  }
}

export async function sendWaitlistConfirm({ email, token }) {
  const link = `${siteUrl()}/api/waitlist/confirm?token=${token}`;
  const subject = 'Confirm your spot on the Pookie list';
  const html = wrapHtml({
    heading: subject,
    bodyHtml: '<p>One click and you\'re on the list.</p>',
    ctaText: 'Confirm my spot',
    ctaHref: link,
  });
  const data = await send({ to: email, subject, html });
  logSend('waitlist_confirm', email, data?.id);
  return data;
}

export async function sendWaitlistWelcome({ email, position, referralCode }) {
  const referralUrl = `${siteUrl()}/?ref=${referralCode}`;
  const subject = `You're #${position} — here's your referral link`;
  const html = wrapHtml({
    heading: subject,
    bodyHtml: `<p>Share your link — each friend who joins moves you up 5 spots.</p><p style="word-break:break-all;"><a href="${referralUrl}">${referralUrl}</a></p>`,
  });
  const data = await send({ to: email, subject, html });
  logSend('waitlist_welcome', email, data?.id);
  return data;
}

export async function sendInviteRecipient({ invite, token }) {
  const respondUrl = `${siteUrl()}/respond.html?token=${token}`;
  const when = formatDateTime(invite.starts_at, invite.timezone);
  const subject = `${invite.sender_name} invited you for a coffee ☕`;
  const html = wrapHtml({
    heading: subject,
    bodyHtml: `
      <p><strong>${escapeHtml(invite.place)}</strong><br/>${escapeHtml(when)}</p>
      ${invite.message ? `<p>"${escapeHtml(invite.message)}"</p>` : ''}
      <p>Accept, suggest another time, or decline — up to you.</p>
    `,
    ctaText: 'Respond to this invite',
    ctaHref: respondUrl,
  });
  const data = await send({ to: invite.recipient_email, subject, html });
  logSend('invite_recipient', invite.recipient_email, data?.id);
  return data;
}

export async function sendInviteSenderCopy({ invite }) {
  const recipientLabel = invite.recipient_name || invite.recipient_email;
  const subject = `Your coffee invite to ${recipientLabel} is sent`;
  const html = wrapHtml({
    heading: subject,
    bodyHtml: "<p>We'll email you the moment they respond.</p>",
  });
  const data = await send({ to: invite.sender_email, subject, html });
  logSend('invite_sender_copy', invite.sender_email, data?.id);
  return data;
}

export async function sendInviteConfirmed({ invite, icsContent }) {
  const when = formatDateTime(invite.starts_at, invite.timezone);
  const subject = `Coffee confirmed: ${invite.place}, ${when}`;
  const attachments = [{
    filename: 'coffee-date.ics',
    content: Buffer.from(icsContent).toString('base64'),
    contentType: 'text/calendar',
  }];
  const bodyHtml = `
    <p>${escapeHtml(invite.sender_name)} and ${escapeHtml(invite.recipient_name || invite.recipient_email)} — you're on for coffee.</p>
    <p><strong>${escapeHtml(invite.place)}</strong><br/>${escapeHtml(when)}</p>
    <p>Calendar invite is attached.</p>
  `;
  const html = wrapHtml({ heading: subject, bodyHtml });

  // Sent independently — one party's delivery failure (bad address, bounce,
  // spam block, whatever) must never suppress the other's, and must never
  // turn an already-successful acceptance into an error response for the
  // user. Previously these were sequential awaits: a thrown error on the
  // sender's send meant the recipient's was never even attempted, which is
  // the most likely explanation for "one side got nothing."
  const [senderResult, recipientResult] = await Promise.allSettled([
    send({ to: invite.sender_email, subject, html, attachments }),
    send({ to: invite.recipient_email, subject, html, attachments }),
  ]);
  logSendResult('invite_confirmed', invite.sender_email, senderResult);
  logSendResult('invite_confirmed', invite.recipient_email, recipientResult);
  return { senderResult, recipientResult };
}

export async function sendInviteDeclined({ invite }) {
  // Both parties get told what happened — the sender that it was declined,
  // the recipient a confirmation their decline went through — sent
  // independently so one failing never blocks or masks the other.
  const recipientLabel = invite.recipient_name || 'They';
  const senderSubject = `${recipientLabel} can't make it`;
  const senderHtml = wrapHtml({
    heading: senderSubject,
    bodyHtml: '<p>No hard feelings — maybe another time.</p>',
  });

  const recipientSubject = `You declined ${invite.sender_name}'s invite`;
  const recipientHtml = wrapHtml({
    heading: recipientSubject,
    bodyHtml: `<p>We let ${escapeHtml(invite.sender_name)} know. No hard feelings.</p>`,
  });

  const [senderResult, recipientResult] = await Promise.allSettled([
    send({ to: invite.sender_email, subject: senderSubject, html: senderHtml }),
    send({ to: invite.recipient_email, subject: recipientSubject, html: recipientHtml }),
  ]);
  logSendResult('invite_declined', invite.sender_email, senderResult);
  logSendResult('invite_declined', invite.recipient_email, recipientResult);
  return { senderResult, recipientResult };
}

export async function sendInviteProposed({ invite, sndToken }) {
  const recipientLabel = invite.recipient_name || 'They';
  const acceptUrl = `${siteUrl()}/respond.html?token=${sndToken}`;
  const when = formatDateTime(invite.proposed_starts_at, invite.timezone);
  const subject = `${recipientLabel} suggested a new time`;
  const html = wrapHtml({
    heading: subject,
    bodyHtml: `<p>New proposed time: <strong>${escapeHtml(when)}</strong></p><p>Accept it below, or just reply to this email to sort out the details.</p>`,
    ctaText: 'Accept the new time',
    ctaHref: acceptUrl,
  });
  const data = await send({ to: invite.sender_email, subject, html });
  logSend('invite_proposed', invite.sender_email, data?.id);
  return data;
}

/* ---------------- "Let's See If We Vibe" (/vibe.html), restored ---------------- */

export async function sendVibeOwnerNotification(response) {
  const to = process.env.REPLY_TO;
  if (!to) return null; // no owner inbox configured — skip quietly, the DB row is still saved
  const subject = 'New "Let\'s Vibe" response';
  const rows = [
    ['Name', response.name], ['Email', response.email], ['Phone', response.phone],
    ['Activity', response.activity], ['Date', response.date], ['Time', response.time],
    ['City', response.city], ['Place', response.place], ['Message', response.message],
  ].filter(([, v]) => v);
  const bodyHtml = `<table role="presentation" style="width:100%;font-size:14px;">${rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#8a7f92;">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join('')}</table>`;
  const html = wrapHtml({ heading: subject, bodyHtml, brand: "Let's Vibe &#128526;" });
  const data = await send({ to, subject, html });
  logSend('vibe_owner_notification', to, data?.id);
  return data;
}

export async function sendVibeVisitorConfirmation({ email, activity, date, time, city, place }) {
  if (!email) return null;
  const subject = 'Good vibes only ✨';
  const placePhrase = place ? ` at ${escapeHtml(place)}` : '';
  const bodyHtml = `<p>You're locked in for <strong>${escapeHtml(activity)}</strong> on ${escapeHtml(date)} at ${escapeHtml(time)}, in ${escapeHtml(city)}${placePhrase}.</p><p>Good vibes only. See you soon.</p>`;
  const html = wrapHtml({ heading: subject, bodyHtml, brand: "Let's Vibe &#128526;" });
  const data = await send({ to: email, subject, html });
  logSend('vibe_visitor_confirmation', email, data?.id);
  return data;
}
