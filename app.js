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
  /* Invite form — real, posts to /api/invite                            */
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
  /* Waitlist form — real, posts to /api/waitlist                        */
  /* ------------------------------------------------------------------ */

  const waitlistForm = document.getElementById('waitlist-form');
  const waitlistSubmit = document.getElementById('wl-submit');
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
      waitlistSubmit.innerHTML = 'Join the waitlist <span class="btn-emoji">→</span>';

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
        document.getElementById('waitlist-success-text').textContent = data.position
          ? `You're already on the list at #${data.position}. Check your inbox if you haven't confirmed yet.`
          : "You're already on the list. Check your inbox if you haven't confirmed yet.";
      }
    });
  }
})();
