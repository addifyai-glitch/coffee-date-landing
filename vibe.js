/* ==========================================================================
   Let's See If We Vibe — page-specific interactions.
   Shared cursor/magnetic/particles/FX/reveal helpers live in common.js
   (window.Shared). Restored from the original design (see git history at
   5732b4f) and adapted to the current server-side backend: this page now
   posts to /api/vibe instead of writing to Supabase and sending via
   EmailJS directly from the browser.
   ========================================================================== */

(() => {
  'use strict';

  Shared.initTheme();
  Shared.initChrome({ variant: 'vibe' });
  Shared.initCursor();
  Shared.initMagnetic();
  Shared.initParticles();
  Shared.initAnalytics();

  const prefersReducedMotion = Shared.prefersReducedMotion;
  const rand = Shared.rand;
  const clamp = Shared.clamp;
  const VIBE_PALETTE = ['#ff6f91', '#c96bd8', '#7c6bf0', '#ffb17a', '#ffffff'];
  const FX = Shared.initFX('fx-canvas', { palette: VIBE_PALETTE });

  /* ------------------------------------------------------------------ */
  /* Rotating pitch (eyebrow + headline + subhead)                       */
  /* ------------------------------------------------------------------ */

  const PITCHES = [
    { eyebrow: 'A spontaneous idea', line1: 'I have a slightly spontaneous idea.', highlight: 'Interested?', sub: 'Only one way to find out.' },
    { eyebrow: 'Plot twist incoming', line1: 'One random decision', highlight: 'could become a great story.', sub: "Or at least a memorable one." },
    { eyebrow: 'No pressure', line1: 'No pressure.', highlight: 'Could be fun.', sub: "That's it. That's the idea." },
    { eyebrow: 'A hypothesis', line1: "Let's find out", highlight: 'if we’re actually fun together.', sub: 'Purely for research purposes.' },
    { eyebrow: 'No real agenda', line1: 'No real agenda —', highlight: 'just seeing what happens.', sub: "Sounds fine to me." },
    { eyebrow: 'Low commitment, high upside', line1: 'One coffee.', highlight: 'Zero pressure. Possibly a great story.', sub: "That's the whole pitch." },
    { eyebrow: 'Low-key idea', line1: 'Nothing fancy —', highlight: 'just good company.', sub: 'Worth a shot.' },
    { eyebrow: 'Today only (not really)', line1: 'Your week could use', highlight: 'a little spontaneity.', sub: "Just a thought." },
  ];

  const pitchBlock = document.getElementById('pitch-block');
  const eyebrowEl = document.getElementById('eyebrow-text');
  const headlineEl = document.getElementById('headline-text');
  const subheadEl = document.getElementById('subhead-text');
  let pitchIndex = 0;

  const rotatePitch = () => {
    pitchBlock.classList.add('pitch-swap');
    setTimeout(() => {
      pitchIndex = (pitchIndex + 1) % PITCHES.length;
      const p = PITCHES[pitchIndex];
      eyebrowEl.textContent = p.eyebrow;
      headlineEl.innerHTML = `${p.line1}<br /><span class="highlight">${p.highlight}</span>`;
      subheadEl.textContent = p.sub;
      pitchBlock.classList.remove('pitch-swap');
    }, 350);
  };

  if (!prefersReducedMotion) setInterval(rotatePitch, 5000);

  /* ------------------------------------------------------------------ */
  /* Activity rotator                                                    */
  /* ------------------------------------------------------------------ */

  const ACTIVITIES = [
    '☕ coffee', '🍸 drinks', '🍕 dinner', '🥐 brunch', '🎵 live music',
    '🎪 a festival', '🎳 bowling', '🕹️ the arcade', '🎤 a comedy show',
    '🚗 a road trip', '🌅 a sunset walk', '🥾 a hike', '🏊 a swim',
    '🎿 skiing or snowboarding', '🍷 glühwein', '🍦 ice cream', '🖼️ a museum',
    '📚 a bookshop', '🧺 a market', '🎲 board games', '🌮 a food adventure',
    '🎁 a total surprise',
  ];
  const activityWordEl = document.getElementById('activity-word');
  let activityIndex = 0;

  const rotateActivity = () => {
    activityWordEl.classList.add('swap');
    setTimeout(() => {
      activityIndex = (activityIndex + 1) % ACTIVITIES.length;
      activityWordEl.textContent = ACTIVITIES[activityIndex];
      activityWordEl.classList.remove('swap');
    }, 300);
  };
  if (!prefersReducedMotion) setInterval(rotateActivity, 2200);

  /* ------------------------------------------------------------------ */
  /* No button — dodges, then settles into a real, clickable button      */
  /* ------------------------------------------------------------------ */

  const noBtn = document.getElementById('no-btn');
  const yesBtn = document.getElementById('yes-btn');
  const buttonRow = document.getElementById('button-row');
  const escapeMessageEl = document.getElementById('escape-message');

  const ESCAPE_MESSAGES = [
    'Smooth. Almost.',
    'Predictable.',
    "That's cute.",
    "You'll need to be quicker.",
    'So close. Try again.',
    'Bold move.',
    'I admire the persistence.',
    'Not happening. Yet.',
  ];

  const FLEE_RADIUS = 130;
  const FLEE_TRANSITION_MS = 450;
  const SETTLE_AFTER_ATTEMPTS = 7;

  let attempts = 0;
  let fleeing = false;
  let settled = false;
  let outcomeDecided = false;
  let escapeMessageTimer = null;

  const showEscapeMessage = () => {
    const msg = ESCAPE_MESSAGES[Math.floor(rand(0, ESCAPE_MESSAGES.length))];
    escapeMessageEl.textContent = msg;
    escapeMessageEl.classList.add('show');
    clearTimeout(escapeMessageTimer);
    escapeMessageTimer = setTimeout(() => escapeMessageEl.classList.remove('show'), 2000);
  };

  const pickEscapePosition = () => {
    const btnRect = noBtn.getBoundingClientRect();
    const yesRect = yesBtn.getBoundingClientRect();
    const margin = 16;
    const w = btnRect.width || 160;
    const h = btnRect.height || 56;
    const maxX = window.innerWidth - w - margin;
    const maxY = window.innerHeight - h - margin;

    let x; let y; let tries = 0;
    do {
      x = rand(margin, Math.max(margin, maxX));
      y = rand(margin, Math.max(margin, maxY));
      tries += 1;
    } while (
      tries < 12 &&
      x < yesRect.right + margin && x + w > yesRect.left - margin &&
      y < yesRect.bottom + margin && y + h > yesRect.top - margin
    );

    return { x, y };
  };

  const settleNoButton = () => {
    settled = true;
    noBtn.style.transition = '';
    noBtn.style.left = '';
    noBtn.style.top = '';
    noBtn.classList.remove('fixed-pos');
    buttonRow.appendChild(noBtn);
    noBtn.classList.add('settled');
    noBtn.setAttribute('aria-label', "Maybe another time — click to confirm you're out");
  };

  const fleeNoButton = () => {
    if (outcomeDecided || settled || fleeing) return;
    fleeing = true;

    const { x, y } = pickEscapePosition();

    if (!noBtn.classList.contains('fixed-pos')) {
      const rect = noBtn.getBoundingClientRect();
      // The glass card uses backdrop-filter, which becomes the containing
      // block for fixed-position descendants. Move the button to <body> so
      // its coordinates are relative to the real viewport, not the card.
      document.body.appendChild(noBtn);
      noBtn.style.left = `${rect.left}px`;
      noBtn.style.top = `${rect.top}px`;
      noBtn.classList.add('fixed-pos');
      void noBtn.offsetWidth;
    }

    noBtn.style.transition = `left ${FLEE_TRANSITION_MS}ms var(--ease-premium), top ${FLEE_TRANSITION_MS}ms var(--ease-premium)`;
    noBtn.style.left = `${x}px`;
    noBtn.style.top = `${y}px`;

    attempts += 1;
    showEscapeMessage();
    Shared.vibrate(16);

    const rect = noBtn.getBoundingClientRect();
    FX.sparkleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 9);

    if (attempts >= SETTLE_AFTER_ATTEMPTS) settleNoButton();

    setTimeout(() => { fleeing = false; }, FLEE_TRANSITION_MS);
  };

  const isNearNoButton = (clientX, clientY) => {
    const rect = noBtn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx; const dy = clientY - cy;
    return Math.sqrt(dx * dx + dy * dy) < FLEE_RADIUS;
  };

  window.addEventListener('pointermove', (e) => {
    if (outcomeDecided || settled) return;
    if (isNearNoButton(e.clientX, e.clientY)) fleeNoButton();
  });

  noBtn.addEventListener('touchstart', (e) => {
    if (settled || outcomeDecided) return;
    e.preventDefault();
    fleeNoButton();
  }, { passive: false });

  noBtn.addEventListener('focus', () => {
    if (settled || outcomeDecided) return;
    fleeNoButton();
    noBtn.blur();
    yesBtn.focus();
  });

  window.addEventListener('resize', () => {
    if (noBtn.classList.contains('fixed-pos')) {
      const rect = noBtn.getBoundingClientRect();
      noBtn.style.left = `${clamp(rect.left, 8, window.innerWidth - rect.width - 8)}px`;
      noBtn.style.top = `${clamp(rect.top, 8, window.innerHeight - rect.height - 8)}px`;
    }
  });

  /* ------------------------------------------------------------------ */
  /* Section transitions                                                 */
  /* ------------------------------------------------------------------ */

  const heroSection = document.getElementById('hero-section');
  const declinedSection = document.getElementById('declined-section');
  const successSection = document.getElementById('success-section');
  const reconsiderBtn = document.getElementById('reconsider-btn');

  const dissolveHero = (onDone) => {
    heroSection.style.transform = 'scale(0.94)';
    heroSection.style.opacity = '0';
    heroSection.style.filter = 'blur(12px)';
    setTimeout(() => {
      heroSection.classList.add('hidden');
      onDone();
    }, 500);
  };

  const revealSuccess = () => {
    successSection.classList.remove('hidden');
    const dateInput = document.getElementById('date-input');
    if (dateInput) {
      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateInput.min = today.toISOString().split('T')[0];
      dateInput.value = tomorrow.toISOString().split('T')[0];
    }
  };

  noBtn.addEventListener('click', (e) => {
    if (!settled) {
      e.preventDefault();
      fleeNoButton();
      return;
    }
    outcomeDecided = true;
    dissolveHero(() => declinedSection.classList.remove('hidden'));
  });

  reconsiderBtn.addEventListener('click', () => {
    declinedSection.style.transform = 'scale(0.94)';
    declinedSection.style.opacity = '0';
    declinedSection.style.filter = 'blur(10px)';
    setTimeout(() => {
      declinedSection.classList.add('hidden');
      const rect = reconsiderBtn.getBoundingClientRect();
      FX.confettiBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, prefersReducedMotion ? 30 : 90);
      revealSuccess();
    }, 400);
  });

  yesBtn.addEventListener('click', () => {
    outcomeDecided = true;
    const rect = yesBtn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    FX.confettiBurst(cx, cy, prefersReducedMotion ? 30 : 110);
    FX.heartBurst(cx, cy, prefersReducedMotion ? 10 : 28);
    dissolveHero(revealSuccess);
  });

  /* ------------------------------------------------------------------ */
  /* Planning form — creates a real invite via /api/invite (origin=vibe),  */
  /* same backend/table/tokens/emails/.ics as the homepage's invite form. */
  /* Two delivery paths: email the recipient directly, or generate the    */
  /* invite with no recipient email and let the sender share the link     */
  /* themselves (WhatsApp / copy / native share).                         */
  /* ------------------------------------------------------------------ */

  const planForm = document.getElementById('plan-form');
  const planFormMessage = document.getElementById('plan-form-message');
  const planStep = document.getElementById('plan-step');
  const confirmedStep = document.getElementById('confirmed-step');
  const confirmedRecap = document.getElementById('confirmed-recap');

  const sendEmailBtn = document.getElementById('send-email-btn');
  const shareWhatsappBtn = document.getElementById('share-whatsapp-btn');
  const recipientEmailInput = document.getElementById('recipient-email-input');
  const recipientEmailError = document.getElementById('recipient-email-input-error');
  const deliveryEmailEcho = document.getElementById('delivery-email-echo');

  const emailSentNotice = document.getElementById('email-sent-notice');
  const emailSentTo = document.getElementById('email-sent-to');
  const shareLinks = document.getElementById('share-links');
  const whatsappShareBtn = document.getElementById('whatsapp-share-btn');
  const copyLinkBtn = document.getElementById('copy-link-btn');
  const nativeShareBtn = document.getElementById('native-share-btn');

  const validateSenderEmail = Shared.wireEmailField('email-input', 'email-input-error');
  const validateRecipientEmail = Shared.wireEmailField('recipient-email-input', 'recipient-email-input-error', { required: false });

  const senderEmailInputEl = document.getElementById('email-input');
  senderEmailInputEl.addEventListener('input', () => {
    deliveryEmailEcho.textContent = senderEmailInputEl.value.trim() || 'your email';
  });

  // Shared checks both delivery paths need: required text fields, activity,
  // place, a future date/time, and consent. Returns the trimmed field values
  // on success, or null (and shows the inline message) on failure.
  const collectSharedFields = () => {
    Shared.setFormMessage(planFormMessage, '', null);

    const senderEmailOk = validateSenderEmail ? validateSenderEmail() : true;
    if (!senderEmailOk) {
      Shared.setFormMessage(planFormMessage, 'Fix the highlighted email address.', 'is-error');
      return null;
    }

    const name = document.getElementById('name-input').value.trim();
    const activity = document.getElementById('activity-input').value;
    const place = document.getElementById('place-input').value.trim();
    const date = document.getElementById('date-input').value;
    const time = document.getElementById('time-input').value;
    const message = document.getElementById('message-input').value.trim();

    if (!name || !activity || !place || !date || !time) {
      Shared.setFormMessage(planFormMessage, 'Fill in your name, the activity, a place, and a date/time.', 'is-error');
      return null;
    }
    if (new Date(`${date}T${time}`).getTime() <= Date.now()) {
      Shared.setFormMessage(planFormMessage, 'Choose a date and time in the future.', 'is-error');
      return null;
    }
    if (!document.getElementById('vibe-consent').checked) {
      Shared.setFormMessage(planFormMessage, 'Agree to the privacy policy to continue.', 'is-error');
      return null;
    }

    return {
      website: document.getElementById('website-input').value,
      sender_name: name,
      sender_email: senderEmailInputEl.value.trim(),
      activity,
      place,
      starts_at: new Date(`${date}T${time}`).toISOString(),
      timezone: (() => {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Vienna'; } catch { return 'Europe/Vienna'; }
      })(),
      message,
      consent: true,
      origin: 'vibe',
      _display: { activity, place, date, time },
    };
  };

  const showConfirmed = (fields) => {
    const rect = planForm.getBoundingClientRect();
    FX.heartBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, prefersReducedMotion ? 8 : 20);
    const { activity, place, date, time } = fields._display;
    confirmedRecap.textContent = `Sent for ${activity} on ${date} at ${time} at ${place}.`;
    planStep.classList.add('hidden');
    confirmedStep.classList.remove('hidden');
  };

  const setButtonsBusy = (busy) => {
    sendEmailBtn.disabled = busy;
    shareWhatsappBtn.disabled = busy;
  };

  sendEmailBtn.addEventListener('click', async () => {
    const fields = collectSharedFields();
    if (!fields) return;

    const recipientOk = validateRecipientEmail ? Shared.validateEmailField(recipientEmailInput, recipientEmailError, { required: true }) : true;
    if (!recipientOk) {
      Shared.setFormMessage(planFormMessage, 'Enter a valid email for the person you\'re inviting.', 'is-error');
      return;
    }

    fields.recipient_email = recipientEmailInput.value.trim();

    setButtonsBusy(true);
    sendEmailBtn.textContent = 'Sending...';
    const { ok, data } = await Shared.apiPost('/api/invite', fields);
    setButtonsBusy(false);
    sendEmailBtn.textContent = 'Send by email 📧';

    if (!ok || !data?.ok) {
      Shared.setFormMessage(planFormMessage, data?.error || 'Something went wrong — try again.', 'is-error');
      return;
    }

    Shared.track('invite_create_vibe');
    emailSentTo.textContent = fields.recipient_email;
    emailSentNotice.classList.remove('hidden');
    shareLinks.classList.add('hidden');
    showConfirmed(fields);
  });

  shareWhatsappBtn.addEventListener('click', async () => {
    const fields = collectSharedFields();
    if (!fields) return;

    setButtonsBusy(true);
    shareWhatsappBtn.textContent = 'Creating...';
    const { ok, data } = await Shared.apiPost('/api/invite', fields);
    setButtonsBusy(false);
    shareWhatsappBtn.textContent = 'Share on WhatsApp 💬';

    if (!ok || !data?.ok || !data.token) {
      Shared.setFormMessage(planFormMessage, data?.error || 'Something went wrong — try again.', 'is-error');
      return;
    }

    Shared.track('invite_create_vibe');

    const respondUrl = `${window.location.origin}/respond.html?token=${encodeURIComponent(data.token)}`;
    const shareText = `Hey! I have an idea: ${fields.activity} at ${fields.place}. Here's the invite — accept, suggest another time, or decline: ${respondUrl}`;

    whatsappShareBtn.href = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    whatsappShareBtn.onclick = () => Shared.track('share_whatsapp');

    copyLinkBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(respondUrl);
        copyLinkBtn.textContent = 'Copied! ✓';
        setTimeout(() => { copyLinkBtn.textContent = 'Copy link 🔗'; }, 2000);
      } catch {
        Shared.setFormMessage(planFormMessage, 'Could not copy — long-press the button below to copy the link instead.', 'is-error');
      }
    };

    if (typeof navigator.share === 'function') {
      nativeShareBtn.classList.remove('hidden');
      nativeShareBtn.onclick = () => {
        navigator.share({ title: "Let's meet up", text: shareText, url: respondUrl }).catch(() => {});
      };
    }

    emailSentNotice.classList.add('hidden');
    shareLinks.classList.remove('hidden');
    showConfirmed(fields);
  });
})();
