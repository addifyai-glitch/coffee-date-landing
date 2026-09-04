/* ==========================================================================
   Pookie homepage — page-specific interactions. Shared cursor/magnetic/
   particles/FX/reveal helpers live in common.js (window.Shared).
   The Vibe Mode grid and phone-mockup demo are decorative previews (no
   backend calls). The invite form and waitlist form are real and post to
   /api/invite and /api/waitlist respectively.
   ========================================================================== */

(() => {
  'use strict';

  Shared.initTheme();
  Shared.initChrome();
  Shared.initCursor();
  Shared.initMagnetic();
  Shared.initParticles();
  Shared.initReveal();
  Shared.initAnalytics();

  const FX = Shared.initFX();
  const prefersReducedMotion = Shared.prefersReducedMotion;

  /* ------------------------------------------------------------------ */
  /* Vibe Mode grid — tappable preview, purely decorative                */
  /* ------------------------------------------------------------------ */

  document.querySelectorAll('.vibe-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.vibe-chip').forEach((c) => c.classList.remove('selected'));
      chip.classList.add('selected');
      const rect = chip.getBoundingClientRect();
      FX.sparkleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, prefersReducedMotion ? 4 : 12);
    });
  });

  /* ------------------------------------------------------------------ */
  /* Interactive product demo (phone mockup) — purely decorative         */
  /* ------------------------------------------------------------------ */

  const demoSteps = Array.from(document.querySelectorAll('.demo-step'));
  const demoFlowItems = Array.from(document.querySelectorAll('.demo-flow-item'));
  const demoPrev = document.getElementById('demo-prev');
  const demoNext = document.getElementById('demo-next');
  let demoIndex = 0;

  if (demoSteps.length) {
    const showDemoStep = (index) => {
      demoIndex = Math.max(0, Math.min(demoSteps.length - 1, index));
      demoSteps.forEach((el) => el.classList.toggle('active', Number(el.dataset.step) === demoIndex));
      demoFlowItems.forEach((el) => el.classList.toggle('active', Number(el.dataset.step) === demoIndex));
      demoPrev.disabled = demoIndex === 0;
      demoNext.textContent = demoIndex === demoSteps.length - 1 ? 'Restart ↺' : 'Next →';
    };

    demoFlowItems.forEach((item) => {
      item.addEventListener('click', () => showDemoStep(Number(item.dataset.step)));
    });

    demoPrev.addEventListener('click', () => showDemoStep(demoIndex - 1));
    demoNext.addEventListener('click', () => {
      if (demoIndex === demoSteps.length - 1) showDemoStep(0);
      else showDemoStep(demoIndex + 1);
    });

    showDemoStep(0);
  }

  /* ------------------------------------------------------------------ */
  /* Shared helpers                                                       */
  /* ------------------------------------------------------------------ */

  const setFormMessage = (el, text, kind) => {
    el.textContent = text;
    el.classList.remove('is-error', 'is-success');
    if (kind) el.classList.add(kind);
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Validates one email field on blur and on submit: shows/hides its inline
  // error span and marks the input invalid. Returns whether it currently
  // passes (empty is only valid when the field isn't required).
  const validateEmailField = (input, errorEl, { required = true } = {}) => {
    const value = input.value.trim();
    const empty = value.length === 0;
    const valid = required ? (!empty && EMAIL_RE.test(value)) : (empty || EMAIL_RE.test(value));
    input.classList.toggle('field-invalid', !valid);
    if (errorEl) errorEl.classList.toggle('show', !valid);
    return valid;
  };

  const wireEmailField = (inputId, errorId, opts) => {
    const input = document.getElementById(inputId);
    const errorEl = document.getElementById(errorId);
    if (!input) return null;
    input.addEventListener('blur', () => validateEmailField(input, errorEl, opts));
    input.addEventListener('input', () => {
      if (input.classList.contains('field-invalid')) validateEmailField(input, errorEl, opts);
    });
    return () => validateEmailField(input, errorEl, opts);
  };

  const tomorrowDateString = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };
  const todayDateString = () => new Date().toISOString().split('T')[0];

  /* ------------------------------------------------------------------ */
  /* Invite form — real, posts to /api/invite                            */
  /* ------------------------------------------------------------------ */

  const inviteForm = document.getElementById('invite-form');
  const inviteSubmit = document.getElementById('invite-submit');
  const inviteMessage = document.getElementById('invite-form-message');
  const inviteSuccess = document.getElementById('invite-success');

  const inviteDateInput = document.getElementById('inv-date');
  if (inviteDateInput) {
    inviteDateInput.min = todayDateString();
    inviteDateInput.value = tomorrowDateString();
  }

  const validateInvSenderEmail = wireEmailField('inv-sender-email', 'inv-sender-email-error');
  const validateInvRecipientEmail = wireEmailField('inv-recipient-email', 'inv-recipient-email-error');

  const getTimezone = () => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Vienna';
    } catch {
      return 'Europe/Vienna';
    }
  };

  if (inviteForm) {
    inviteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      setFormMessage(inviteMessage, '', null);

      const senderEmailOk = validateInvSenderEmail ? validateInvSenderEmail() : true;
      const recipientEmailOk = validateInvRecipientEmail ? validateInvRecipientEmail() : true;
      if (!senderEmailOk || !recipientEmailOk) {
        setFormMessage(inviteMessage, 'Fix the highlighted email address.', 'is-error');
        return;
      }

      const date = document.getElementById('inv-date').value;
      const time = document.getElementById('inv-time').value;
      if (!date || !time) {
        setFormMessage(inviteMessage, 'Choose a date and time.', 'is-error');
        return;
      }
      if (new Date(`${date}T${time}`).getTime() <= Date.now()) {
        setFormMessage(inviteMessage, 'Choose a date and time in the future.', 'is-error');
        return;
      }

      const consent = document.getElementById('inv-consent').checked;
      if (!consent) {
        setFormMessage(inviteMessage, 'Agree to the privacy policy to send an invite.', 'is-error');
        return;
      }

      const payload = {
        website: document.getElementById('inv-website').value,
        sender_name: document.getElementById('inv-sender-name').value.trim(),
        sender_email: document.getElementById('inv-sender-email').value.trim(),
        recipient_name: document.getElementById('inv-recipient-name').value.trim(),
        recipient_email: document.getElementById('inv-recipient-email').value.trim(),
        place: document.getElementById('inv-place').value.trim(),
        starts_at: new Date(`${date}T${time}`).toISOString(),
        timezone: getTimezone(),
        message: document.getElementById('inv-message').value.trim(),
        consent,
      };

      inviteSubmit.disabled = true;
      inviteSubmit.textContent = 'Sending...';

      const { ok, data } = await Shared.apiPost('/api/invite', payload);

      inviteSubmit.disabled = false;
      inviteSubmit.textContent = 'Send the invite';

      if (!ok || !data?.ok) {
        setFormMessage(inviteMessage, data?.error || 'Something went wrong — try again.', 'is-error');
        return;
      }

      Shared.track('invite_create');
      const rect = inviteForm.getBoundingClientRect();
      FX.sparkleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, prefersReducedMotion ? 8 : 24);

      inviteForm.classList.add('hidden');
      inviteSuccess.classList.remove('hidden');
    });
  }

  /* ------------------------------------------------------------------ */
  /* Waitlist form — real, posts to /api/waitlist                        */
  /* ------------------------------------------------------------------ */

  const waitlistForm = document.getElementById('waitlist-form');
  const waitlistSubmit = document.getElementById('wl-submit');
  const waitlistMessage = document.getElementById('waitlist-form-message');
  const waitlistSuccess = document.getElementById('waitlist-success');

  const validateWlEmail = wireEmailField('wl-email', 'wl-email-error');

  // Live waitlist count badge — a real number from the DB, not a made-up
  // one. Stays hidden on any failure or while loading; only shown once we
  // have a real count to report, so we never show a stale "0" flash.
  const waitlistCountEl = document.getElementById('waitlist-count');
  if (waitlistCountEl) {
    Shared.apiGet('/api/waitlist/count').then(({ ok, data }) => {
      if (!ok || !data?.ok || typeof data.count !== 'number') return;
      const { count } = data;
      const label = count === 0
        ? 'Be the first to join'
        : count === 1
          ? '1 person has joined the waitlist'
          : `${count.toLocaleString()} people have joined the waitlist`;
      waitlistCountEl.innerHTML = `<span class="waitlist-count-dot" aria-hidden="true"></span>${label}`;
      waitlistCountEl.classList.remove('hidden');
    });
  }

  const urlParams = new URLSearchParams(window.location.search);

  if (waitlistForm) {
    waitlistForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      setFormMessage(waitlistMessage, '', null);

      const emailOk = validateWlEmail ? validateWlEmail() : true;
      if (!emailOk) {
        setFormMessage(waitlistMessage, 'Fix the highlighted email address.', 'is-error');
        return;
      }

      const consent = document.getElementById('wl-consent').checked;
      if (!consent) {
        setFormMessage(waitlistMessage, 'Agree to the privacy policy to join the waitlist.', 'is-error');
        return;
      }

      const payload = {
        website: document.getElementById('wl-website').value,
        name: document.getElementById('wl-name').value.trim(),
        email: document.getElementById('wl-email').value.trim(),
        city: document.getElementById('wl-city').value.trim(),
        consent,
        source: urlParams.get('ref') ? 'referral' : 'landing',
        utm_source: urlParams.get('utm_source') || '',
        utm_medium: urlParams.get('utm_medium') || '',
        utm_campaign: urlParams.get('utm_campaign') || '',
        ref: urlParams.get('ref') || '',
      };

      waitlistSubmit.disabled = true;
      waitlistSubmit.textContent = 'Joining...';

      const { ok, data } = await Shared.apiPost('/api/waitlist', payload);

      waitlistSubmit.disabled = false;
      waitlistSubmit.innerHTML = 'Join the waitlist <span class="btn-emoji">→</span>';

      if (!ok || !data?.ok) {
        setFormMessage(waitlistMessage, data?.error || 'Something went wrong — try again.', 'is-error');
        return;
      }

      Shared.track('waitlist_submit');
      const rect = waitlistForm.getBoundingClientRect();
      FX.confettiBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, prefersReducedMotion ? 24 : 80);

      waitlistForm.classList.add('hidden');
      waitlistSuccess.classList.remove('hidden');
      if (data.already_registered) {
        document.getElementById('waitlist-success-text').textContent = data.position
          ? `You're already on the list at #${data.position}. Check your inbox if you haven't confirmed yet.`
          : "You're already on the list. Check your inbox if you haven't confirmed yet.";
      }
    });
  }
})();
