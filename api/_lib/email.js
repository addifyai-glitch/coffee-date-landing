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
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: timezone || 'Europe/Vienna',
    }).format(new Date(isoString));
  } catch {
    return new Date(isoString).toISOString();
  }
}

function toText(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function wrapHtml({ preheader = '', heading, bodyHtml, ctaText, ctaHref }) {
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#F4EBDD;font-family:Georgia,'Times New Roman',serif;color:#2B1D16;">
  <span style="display:none;opacity:0;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4EBDD;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#2B1D16;padding:24px 32px;">
          <span style="color:#F4EBDD;font-size:20px;font-weight:700;letter-spacing:0.02em;">Pookie &#9749;</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:22px;color:#2B1D16;">${heading}</h1>
          <div style="font-size:15px;line-height:1.6;color:#4a382e;">${bodyHtml}</div>
          ${ctaText && ctaHref ? `<p style="margin:28px 0 0;"><a href="${ctaHref}" style="display:inline-block;background:#C8552D;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">${escapeHtml(ctaText)}</a></p>` : ''}
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #eee;">
          <p style="margin:0;font-size:12px;color:#8A7A6E;">Sent by Pookie. If this wasn't you, you can safely ignore this email.</p>
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

  const results = [];
  results.push(await send({ to: invite.sender_email, subject, html, attachments }));
  logSend('invite_confirmed', invite.sender_email, results[0]?.id);
  results.push(await send({ to: invite.recipient_email, subject, html, attachments }));
  logSend('invite_confirmed', invite.recipient_email, results[1]?.id);
  return results;
}

export async function sendInviteDeclined({ invite }) {
  const recipientLabel = invite.recipient_name || 'They';
  const subject = `${recipientLabel} can't make it`;
  const html = wrapHtml({
    heading: subject,
    bodyHtml: '<p>No hard feelings — maybe another time.</p>',
  });
  const data = await send({ to: invite.sender_email, subject, html });
  logSend('invite_declined', invite.sender_email, data?.id);
  return data;
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
