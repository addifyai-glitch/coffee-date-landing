/* ==========================================================================
   Pookie marketing page — page-specific interactions.
   Shared cursor/magnetic/particles/FX/Supabase/EmailJS/reveal helpers live
   in ../common.js (window.Shared).
   ========================================================================== */

(() => {
  'use strict';

  Shared.initTheme();
  Shared.initChrome({ pookieBase: './', rootBase: '../', variant: 'pookie' });
  Shared.initCursor();
  Shared.initMagnetic();
  Shared.initParticles();
  Shared.initReveal();
  Shared.initEmailJS();
  Shared.logPageView('pookie:home');

  const FX = Shared.initFX();
  const prefersReducedMotion = Shared.prefersReducedMotion;

  /* ------------------------------------------------------------------ */
  /* Vibe Mode grid — tappable preview + lightweight signal logging       */
  /* ------------------------------------------------------------------ */

  document.querySelectorAll('.vibe-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.vibe-chip').forEach((c) => c.classList.remove('selected'));
      chip.classList.add('selected');
      const rect = chip.getBoundingClientRect();
      FX.sparkleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, prefersReducedMotion ? 4 : 12);
      Shared.supabaseInsert('demo_events', [{ event_type: 'vibe_pick', value: chip.dataset.vibe }]).catch(() => {});
    });
  });

  /* ------------------------------------------------------------------ */
  /* Interactive product demo                                            */
  /* ------------------------------------------------------------------ */

  const demoSteps = Array.from(document.querySelectorAll('.demo-step'));
  const demoFlowItems = Array.from(document.querySelectorAll('.demo-flow-item'));
  const demoPrev = document.getElementById('demo-prev');
  const demoNext = document.getElementById('demo-next');
  let demoIndex = 0;

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
    if (demoIndex === demoSteps.length - 1) {
      showDemoStep(0);
    } else {
      showDemoStep(demoIndex + 1);
    }
  });

  showDemoStep(0);

  /* ------------------------------------------------------------------ */
  /* Waitlist multi-step form                                            */
  /* ------------------------------------------------------------------ */

  const stepEls = {
    1: document.getElementById('step-1'),
    2: document.getElementById('step-2'),
    3: document.getElementById('step-3'),
    4: document.getElementById('step-4'),
  };
  const stepDots = Array.from(document.querySelectorAll('.step-dot'));

  let signupId = null;
  let selectedInterests = new Set();
  let selectedWouldUse = null;
  let selectedNameOpinion = null;

  const goToStep = (n) => {
    Object.values(stepEls).forEach((el) => el.classList.add('hidden'));
    stepEls[n].classList.remove('hidden');
    stepDots.forEach((dot) => {
      const dotNum = Number(dot.dataset.dot);
      dot.classList.toggle('active', dotNum === n);
      dot.classList.toggle('done', dotNum < n);
    });
    stepEls[n].scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' });
  };

  const setupChipGroup = (containerId, onSelect, { multi = false } = {}) => {
    const container = document.getElementById(containerId);
    const selected = new Set();
    container.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        if (multi) {
          chip.classList.toggle('selected');
          if (chip.classList.contains('selected')) selected.add(chip.dataset.value);
          else selected.delete(chip.dataset.value);
        } else {
          container.querySelectorAll('.chip').forEach((c) => c.classList.remove('selected'));
          chip.classList.add('selected');
          selected.clear();
          selected.add(chip.dataset.value);
        }
        onSelect(multi ? selected : chip.dataset.value);
      });
    });
    return selected;
  };

  selectedInterests = setupChipGroup('interest-chips', () => {}, { multi: true });

  /* --- Step 1: waitlist info --- */

  const waitlistForm = document.getElementById('waitlist-form');
  const step1Submit = document.getElementById('wl-step1-submit');

  const turnstileReady = () => Boolean(window.CONFIG && CONFIG.TURNSTILE_SITE_KEY);

  if (turnstileReady() && window.turnstile) {
    window.addEventListener('load', () => {
      try {
        turnstile.render('#turnstile-widget', { sitekey: CONFIG.TURNSTILE_SITE_KEY });
      } catch (err) { /* Turnstile not ready yet — safe to ignore, form still works. */ }
    });
  }

  waitlistForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (turnstileReady() && window.turnstile) {
      const token = turnstile.getResponse();
      if (!token) {
        step1Submit.textContent = 'Please complete the check above';
        setTimeout(() => { step1Submit.textContent = 'Continue →'; }, 2200);
        return;
      }
    }

    step1Submit.disabled = true;
    step1Submit.textContent = 'Saving...';

    const payload = {
      first_name: document.getElementById('wl-name').value.trim() || null,
      email: document.getElementById('wl-email').value.trim() || null,
      country: document.getElementById('wl-country').value.trim() || null,
      instagram: document.getElementById('wl-instagram').value.trim() || null,
      age_group: document.getElementById('wl-age').value || null,
      interests: Array.from(selectedInterests),
    };

    try {
      const rows = await Shared.supabaseInsert('waitlist_signups', [payload], { returnRepresentation: true });
      if (rows && rows[0]) signupId = rows[0].id;
    } catch (err) {
      console.warn(err);
    }

    step1Submit.disabled = false;
    step1Submit.innerHTML = 'Continue <span class="btn-emoji">→</span>';
    goToStep(2);
  });

  /* --- Step 2: validation survey --- */

  const validationDeepDive = document.getElementById('validation-deep-dive');
  const validationForm = document.getElementById('validation-form');

  setupChipGroup('would-use-options', (value) => {
    selectedWouldUse = value;
    if (value === 'Not Interested') {
      persistValidation({}).then(() => goToStep(3));
    } else {
      validationDeepDive.classList.remove('hidden');
    }
  });

  async function persistValidation(extra) {
    if (!signupId) return;
    try {
      await Shared.supabaseUpdate('waitlist_signups', signupId, { would_use: selectedWouldUse, ...extra });
    } catch (err) {
      console.warn(err);
    }
  }

  validationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = validationForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    await persistValidation({
      excites_most: document.getElementById('val-excites').value.trim() || null,
      biggest_concern: document.getElementById('val-concern').value.trim() || null,
      favorite_feature: document.getElementById('val-feature').value || null,
      would_pay: document.getElementById('val-pay').value || null,
      would_recommend: document.getElementById('val-recommend').value || null,
      current_method: document.getElementById('val-method').value.trim() || null,
      suggestions: document.getElementById('val-suggestions').value.trim() || null,
    });

    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Continue <span class="btn-emoji">→</span>';
    goToStep(3);
  });

  /* --- Step 3: name feedback --- */

  const nameAltWrap = document.getElementById('name-alt-wrap');
  const nameFormSubmit = document.getElementById('name-form-submit');
  const nameForm = document.getElementById('name-form');

  setupChipGroup('name-opinion-options', (value) => {
    selectedNameOpinion = value;
    nameFormSubmit.disabled = false;
    if (value === 'Prefer something else') nameAltWrap.classList.remove('hidden');
    else nameAltWrap.classList.add('hidden');
  });

  nameForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    nameFormSubmit.disabled = true;
    nameFormSubmit.textContent = 'Finishing...';

    const nameAlternative = document.getElementById('name-alternative').value.trim() || null;

    if (signupId) {
      try {
        await Shared.supabaseUpdate('waitlist_signups', signupId, {
          name_opinion: selectedNameOpinion,
          name_alternative: nameAlternative,
        });
      } catch (err) {
        console.warn(err);
      }
    }

    const emailValue = document.getElementById('wl-email').value.trim();
    const emailParams = {
      name: document.getElementById('wl-name').value.trim() || 'there',
      email: emailValue,
      country: document.getElementById('wl-country').value.trim(),
      would_use: selectedWouldUse || 'n/a',
      name_opinion: selectedNameOpinion || 'n/a',
      owner_email: CONFIG.OWNER_EMAIL,
    };
    const sends = [Shared.sendEmail(CONFIG.EMAILJS_WAITLIST_OWNER_TEMPLATE_ID, emailParams)];
    if (emailValue) sends.push(Shared.sendEmail(CONFIG.EMAILJS_WAITLIST_VISITOR_TEMPLATE_ID, emailParams));
    await Promise.allSettled(sends);

    const rect = nameForm.getBoundingClientRect();
    FX.confettiBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, prefersReducedMotion ? 30 : 100);

    goToStep(4);
  });
})();
