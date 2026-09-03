/* ==========================================================================
   Homepage — page-specific interactions. Shared helpers live in common.js
   (window.Shared). Both forms post straight to /api/*.
   ========================================================================== */

(() => {
  'use strict';

  Shared.initTheme();
  Shared.initChrome();
  Shared.initCursor();
  Shared.initMagnetic();
  Shared.initTilt();
  Shared.initParticles();
  Shared.initReveal();
  Shared.initAnalytics();

  const FX = Shared.initFX();
  const prefersReducedMotion = Shared.prefersReducedMotion;

  /* ------------------------------------------------------------------ */
  /* Interactive invite-preview card — flips to "Accepted" on hover/tap  */
  /* ------------------------------------------------------------------ */

  const invitePreview = document.getElementById('invite-preview');
  if (invitePreview) {
    const setAccepted = (on) => {
      invitePreview.classList.toggle('is-accepted', on);
      invitePreview.querySelector('.invite-preview-status').textContent = on ? 'Accepted' : 'Waiting for a reply';
    };
    if (!Shared.isCoarsePointer) {
      invitePreview.addEventListener('mouseenter', () => setAccepted(true));
      invitePreview.addEventListener('mouseleave', () => setAccepted(false));
    } else {
      invitePreview.addEventListener('click', () => setAccepted(!invitePreview.classList.contains('is-accepted')));
    }
  }

  /* ------------------------------------------------------------------ */
  /* Invite form                                                         */
  /* ------------------------------------------------------------------ */

  const inviteForm = document.getElementById('invite-form');
  const inviteSubmit = document.getElementById('invite-submit');
  const inviteMessage = document.getElementById('invite-form-message');
  const inviteSuccess = document.getElementById('invite-success');

  const inviteDateInput = document.getElementById('inv-date');
  if (inviteDateInput) inviteDateInput.min = new Date().toISOString().split('T')[0];

  const getTimezone = () => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Vienna';
    } catch {
      return 'Europe/Vienna';
    }
  };

  const setFormMessage = (el, text, kind) => {
    el.textContent = text;
    el.classList.remove('is-error', 'is-success');
    if (kind) el.classList.add(kind);
  };

  if (inviteForm) {
    inviteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      setFormMessage(inviteMessage, '', null);

      const date = document.getElementById('inv-date').value;
      const time = document.getElementById('inv-time').value;
      if (!date || !time) {
        setFormMessage(inviteMessage, 'Please choose a date and time.', 'is-error');
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
      };

      inviteSubmit.disabled = true;
      inviteSubmit.textContent = 'Sending...';

      const { ok, data } = await Shared.apiPost('/api/invite', payload);

      inviteSubmit.disabled = false;
      inviteSubmit.textContent = 'Send the invite';

      if (!ok || !data?.ok) {
        setFormMessage(inviteMessage, data?.error || 'Something went wrong. Please try again.', 'is-error');
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
  /* Waitlist form                                                       */
  /* ------------------------------------------------------------------ */

  const waitlistForm = document.getElementById('waitlist-form');
  const waitlistSubmit = document.getElementById('waitlist-submit');
  const waitlistMessage = document.getElementById('waitlist-form-message');
  const waitlistSuccess = document.getElementById('waitlist-success');

  const urlParams = new URLSearchParams(window.location.search);

  if (waitlistForm) {
    waitlistForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      setFormMessage(waitlistMessage, '', null);

      const consent = document.getElementById('wl-consent').checked;
      if (!consent) {
        setFormMessage(waitlistMessage, 'Please agree to the privacy policy to join the waitlist.', 'is-error');
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
      waitlistSubmit.textContent = 'Join the waitlist';

      if (!ok || !data?.ok) {
        setFormMessage(waitlistMessage, data?.error || 'Something went wrong. Please try again.', 'is-error');
        return;
      }

      Shared.track('waitlist_submit');
      const rect = waitlistForm.getBoundingClientRect();
      FX.confettiBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, prefersReducedMotion ? 24 : 80);

      waitlistForm.classList.add('hidden');
      waitlistSuccess.classList.remove('hidden');
      if (data.already_registered) {
        waitlistSuccess.querySelector('h3').textContent = "You're already on the list";
        waitlistSuccess.querySelector('p').textContent = data.position
          ? `You're #${data.position}. Check your inbox if you haven't confirmed yet.`
          : "Check your inbox if you haven't confirmed yet.";
      }
    });
  }
})();
