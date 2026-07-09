/* ==========================================================================
   Let's See If We Vibe — page-specific interactions.
   Shared cursor/magnetic/particles/FX/Supabase/EmailJS helpers live in
   common.js (window.Shared). This file only handles what's unique to the
   personal invitation page.
   ========================================================================== */

(() => {
  'use strict';

  Shared.initTheme();
  Shared.initChrome({ pookieBase: 'pookie/', rootBase: './', variant: 'vibe', minimalNav: true });
  Shared.initCursor();
  Shared.initMagnetic();
  Shared.initParticles();
  Shared.initEmailJS();
  Shared.logPageView('vibe');

  const prefersReducedMotion = Shared.prefersReducedMotion;
  const rand = Shared.rand;
  const clamp = Shared.clamp;
  const FX = Shared.initFX();

  /* ------------------------------------------------------------------ */
  /* Rotating pitch (eyebrow + headline + subhead)                       */
  /* ------------------------------------------------------------------ */

  const PITCHES = [
    { eyebrow: 'A mildly reckless proposal', line1: 'I have a slightly irresponsible idea.', highlight: 'Interested?', sub: 'Only one way to find out.' },
    { eyebrow: 'Plot twist incoming', line1: 'One random decision', highlight: 'could become a great story.', sub: "Or at least a memorable one." },
    { eyebrow: 'Fair warning', line1: 'Fair warning:', highlight: 'this might be dangerously fun.', sub: "I take zero responsibility for a good time." },
    { eyebrow: 'A hypothesis', line1: "Let's find out", highlight: 'if we’re actually fun together.', sub: 'Purely for research purposes.' },
    { eyebrow: 'Two possible outcomes', line1: 'This could go two ways:', highlight: 'hilarious, or unforgettable.', sub: "Either one works for me." },
    { eyebrow: 'Low commitment, high upside', line1: 'One coffee.', highlight: 'Zero pressure. Possibly a great story.', sub: "That's the whole pitch." },
    { eyebrow: 'A modest proposal', line1: 'I promise nothing.', highlight: 'Except at least one good laugh.', sub: 'Terms and conditions may apply.' },
    { eyebrow: 'Today only (not really)', line1: 'Your week could use', highlight: 'a little unplanned chaos.', sub: "Just a thought." },
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
    '☕ coffee', '🍸 drinks', '🍕 dinner', '🎵 live music', '🎪 a festival',
    '🎳 bowling', '🕹️ the arcade', '🎤 a comedy show', '🚗 a road trip',
    '🌅 a sunset walk', '🍦 ice cream', '🖼️ a museum', '🌮 a food adventure',
    '🎲 a total surprise',
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
    if (dateInput) dateInput.min = new Date().toISOString().split('T')[0];
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
  /* WhatsApp message builder                                            */
  /* ------------------------------------------------------------------ */

  const buildWhatsAppUrl = (data) => {
    const lines = [
      'Hey 😄', '',
      "Looks like we're officially meeting.", '',
      `Activity: ${data.activity}`,
      `Date: ${data.date}`,
      `Time: ${data.time}`,
      `City: ${data.city}`,
      '', 'Looking forward to it.',
    ];
    const text = encodeURIComponent(lines.join('\n'));
    return `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${text}`;
  };

  /* ------------------------------------------------------------------ */
  /* Planning form                                                       */
  /* ------------------------------------------------------------------ */

  const planForm = document.getElementById('plan-form');
  const submitBtn = document.getElementById('submit-btn');
  const planStep = document.getElementById('plan-step');
  const confirmedStep = document.getElementById('confirmed-step');
  const confirmedRecap = document.getElementById('confirmed-recap');
  const whatsappFallback = document.getElementById('whatsapp-fallback');

  const saveResponse = async (data) => {
    await Shared.supabaseInsert('responses', [{
      name: data.name || null,
      email: data.email || null,
      phone: data.phone || null,
      activity: data.activity || null,
      preferred_date: data.date || null,
      preferred_time: data.time || null,
      city: data.city || null,
      message: data.message || null,
    }]);
  };

  const sendEmails = async (data) => {
    const params = { ...data, owner_email: CONFIG.OWNER_EMAIL };
    const sends = [Shared.sendEmail(CONFIG.EMAILJS_OWNER_TEMPLATE_ID, params)];
    if (data.email) sends.push(Shared.sendEmail(CONFIG.EMAILJS_VISITOR_TEMPLATE_ID, params));
    await Promise.allSettled(sends);
  };

  planForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
      name: document.getElementById('name-input').value.trim(),
      email: document.getElementById('email-input').value.trim(),
      phone: document.getElementById('phone-input').value.trim(),
      activity: document.getElementById('activity-input').value,
      date: document.getElementById('date-input').value,
      time: document.getElementById('time-input').value,
      city: document.getElementById('city-input').value.trim(),
      message: document.getElementById('message-input').value.trim(),
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Locking it in...';

    const results = await Promise.allSettled([saveResponse(data), sendEmails(data)]);
    results.forEach((r) => { if (r.status === 'rejected') console.warn(r.reason); });

    const waUrl = buildWhatsAppUrl(data);
    whatsappFallback.href = waUrl;
    window.open(waUrl, '_blank', 'noopener');

    const rect = planForm.getBoundingClientRect();
    FX.heartBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, prefersReducedMotion ? 8 : 20);

    confirmedRecap.textContent = `Sent for ${data.activity} on ${data.date} at ${data.time} in ${data.city}.`;
    planStep.classList.add('hidden');
    confirmedStep.classList.remove('hidden');
  });
})();
