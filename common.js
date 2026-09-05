/* ==========================================================================
   Shared foundation — loaded on every page. Theme toggle, nav/footer
   injection, cursor, magnetic buttons, ambient particles, scroll-reveal,
   the FX canvas, a tiny fetch-JSON helper for /api/*, and the FAQ accordion.
   The browser never talks to Supabase or Resend directly — everything goes
   through /api/*.
   ========================================================================== */

const Shared = (() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const rand = (min, max) => Math.random() * (max - min) + min;
  const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
  const vibrate = (pattern) => { if (navigator.vibrate) navigator.vibrate(pattern); };

  /* ---------------- Theme ---------------- */

  const THEME_KEY = 'pookie-theme';

  const applyTheme = (theme) => {
    if (theme) document.documentElement.setAttribute('data-theme', theme);
    else document.documentElement.removeAttribute('data-theme');
  };

  const currentIsDark = () => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  const updateThemeToggleIcon = () => {
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = currentIsDark() ? '☀️' : '🌙';
  };

  const initTheme = () => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) applyTheme(saved);
    updateThemeToggleIcon();
  };

  const toggleTheme = () => {
    const next = currentIsDark() ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
    updateThemeToggleIcon();
  };

  /* ---------------- Nav + footer injection ---------------- */

  const NAV_LINKS = [
    { label: 'Philosophy', href: '/#philosophy' },
    { label: 'Features', href: '/#features' },
    { label: 'Vibe Mode', href: '/#vibe-mode' },
    { label: 'Invite someone', href: '/#invite' },
    { label: 'Waitlist', href: '/#waitlist' },
    { label: 'FAQ', href: '/faq.html' },
  ];

  const buildNav = (variant) => {
    if (variant === 'vibe') {
      // Minimal nav for the "Let's Vibe" easter-egg page — brand mark plus
      // a single link back to the main Pookie product.
      return `
        <a href="/vibe.html" class="nav-brand"><span aria-hidden="true">😎</span> Let's Vibe</a>
        <ul class="nav-links"><li><a href="/">Pookie 💗</a></li></ul>
        <div class="nav-actions">
          <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Toggle dark mode">🌙</button>
        </div>
      `;
    }
    const linksHtml = NAV_LINKS.map((l) => `<li><a href="${l.href}">${l.label}</a></li>`).join('');
    return `
      <a href="/" class="nav-brand"><span aria-hidden="true">💗</span> Pookie</a>
      <ul class="nav-links">${linksHtml}</ul>
      <div class="nav-actions">
        <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Toggle dark mode">🌙</button>
        <button class="nav-menu-toggle" id="nav-menu-toggle" type="button" aria-label="Toggle menu">☰</button>
      </div>
    `;
  };

  const buildFooter = () => `
    <p class="footer-tagline">Built with ❤️ — Currently in Early Access</p>
    <p class="footer-sub">Pookie is an early test project. Nothing here is a finished product.</p>
    <ul class="footer-links">
      <li><a href="/about.html">About</a></li>
      <li><a href="/faq.html">FAQ</a></li>
      <li><a href="/contact.html">Contact</a></li>
      <li><a href="/privacy.html">Privacy</a></li>
      <li><a href="/datenschutz.html">Datenschutz</a></li>
      <li><a href="/terms.html">Terms</a></li>
      <li><a href="/#waitlist">Waitlist</a></li>
      <li><a href="/vibe.html">Let's Vibe 😎</a></li>
    </ul>
    <p class="footer-credit">© <span id="footer-year"></span> Pookie Labs. Made for humans, not algorithms.</p>
  `;

  const initChrome = (opts = {}) => {
    const { variant } = opts;
    const navEl = document.getElementById('site-nav');
    if (navEl) {
      navEl.innerHTML = buildNav(variant);
      if (variant === 'vibe') navEl.classList.add('nav-minimal');
      const menuToggle = document.getElementById('nav-menu-toggle');
      if (menuToggle) menuToggle.addEventListener('click', () => navEl.classList.toggle('nav-open'));
      const themeBtn = document.getElementById('theme-toggle');
      if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
    }
    const footerEl = document.getElementById('site-footer');
    if (footerEl) {
      footerEl.innerHTML = buildFooter();
      const yearEl = document.getElementById('footer-year');
      if (yearEl) yearEl.textContent = new Date().getFullYear();
    }
    updateThemeToggleIcon();
  };

  /* ---------------- Custom cursor ---------------- */

  const initCursor = () => {
    const cursorDot = document.getElementById('cursor-dot');
    if (!cursorDot || isCoarsePointer) return;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let rx = x;
    let ry = y;
    window.addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; });
    const hoverTargets = 'button, a, input, select, textarea, .field, .invite-preview';
    document.addEventListener('pointerover', (e) => {
      if (e.target.closest && e.target.closest(hoverTargets)) cursorDot.classList.add('cursor-hover');
    });
    document.addEventListener('pointerout', (e) => {
      if (e.target.closest && e.target.closest(hoverTargets)) cursorDot.classList.remove('cursor-hover');
    });
    const render = () => {
      rx += (x - rx) * 0.35;
      ry += (y - ry) * 0.35;
      cursorDot.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  };

  /* ---------------- Magnetic buttons ---------------- */

  const attachMagnetic = (el) => {
    if (prefersReducedMotion || isCoarsePointer) return;
    const strength = 0.22;
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const relX = e.clientX - (rect.left + rect.width / 2);
      const relY = e.clientY - (rect.top + rect.height / 2);
      el.style.transform = `translate(${relX * strength}px, ${relY * strength}px)`;
    });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });
  };

  const initMagnetic = (selector = '.magnetic') => {
    document.querySelectorAll(selector).forEach(attachMagnetic);
  };

  /* ---------------- Tilt (interactive invite-preview card) ---------------- */

  const initTilt = (selector = '.invite-preview') => {
    if (prefersReducedMotion || isCoarsePointer) return;
    document.querySelectorAll(selector).forEach((el) => {
      const strength = 10;
      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const relX = (e.clientX - rect.left) / rect.width - 0.5;
        const relY = (e.clientY - rect.top) / rect.height - 0.5;
        el.style.transform = `rotateY(${relX * strength}deg) rotateX(${relY * -strength}deg)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    });
  };

  /* ---------------- Ambient particles ---------------- */

  const initParticles = (containerId = 'particles', { color } = {}) => {
    const layer = document.getElementById(containerId);
    if (!layer || prefersReducedMotion) return;
    const spawn = () => {
      const el = document.createElement('span');
      el.className = 'particle';
      const size = rand(3, 6);
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.left = `${rand(0, 100)}vw`;
      el.style.bottom = '-4vh';
      if (color) el.style.background = color;
      el.style.setProperty('--drift', `${rand(-50, 50)}px`);
      el.style.animationDuration = `${rand(14, 24)}s`;
      layer.appendChild(el);
      setTimeout(() => el.remove(), 25000);
    };
    setInterval(spawn, 1400);
  };

  /* ---------------- Scroll reveal ---------------- */

  const initReveal = (selector = '.reveal') => {
    const items = document.querySelectorAll(selector);
    if (!items.length) return;
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('in-view'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });
    items.forEach((el) => observer.observe(el));
  };

  /* ---------------- FX canvas (confetti / sparkles, café palette) ---------------- */

  const initFX = (canvasId = 'fx-canvas', { palette: customPalette } = {}) => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    let particles = [];
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const MAX_PARTICLES = 260;
    let running = false;

    function loop() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => p.update());
      particles = particles.filter((p) => p.life > 0);
      particles.forEach((p) => p.draw(ctx));
      if (particles.length > 0) requestAnimationFrame(loop);
      else running = false;
    }

    const ensureLoop = () => { if (!running) { running = true; requestAnimationFrame(loop); } };
    const addParticles = (newOnes) => {
      const room = MAX_PARTICLES - particles.length;
      if (room <= 0) return;
      particles.push(...newOnes.slice(0, room));
      ensureLoop();
    };

    const PALETTE = customPalette || ['#C8552D', '#8A9A7B', '#F4EBDD', '#2B1D16'];

    class ConfettiPiece {
      constructor(x, y) {
        this.x = x; this.y = y;
        this.w = rand(6, 11); this.h = rand(8, 14);
        this.color = PALETTE[Math.floor(rand(0, PALETTE.length))];
        this.vx = rand(-6, 6); this.vy = rand(-11, -4);
        this.rotation = rand(0, Math.PI * 2); this.vr = rand(-0.2, 0.2);
        this.gravity = 0.28; this.life = 1; this.decay = rand(0.006, 0.012);
      }
      update() { this.vy += this.gravity; this.x += this.vx; this.y += this.vy; this.rotation += this.vr; this.life -= this.decay; }
      draw(c) {
        c.save(); c.globalAlpha = clamp(this.life, 0, 1);
        c.translate(this.x, this.y); c.rotate(this.rotation);
        c.fillStyle = this.color; c.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
        c.restore();
      }
    }

    class SparkParticle {
      constructor(x, y, angle, speed, color) {
        this.x = x; this.y = y;
        this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed;
        this.life = 1; this.decay = rand(0.014, 0.022);
        this.color = color; this.size = rand(2, 4);
      }
      update() { this.vy += 0.05; this.vx *= 0.98; this.x += this.vx; this.y += this.vy; this.life -= this.decay; }
      draw(c) {
        c.save(); c.globalAlpha = clamp(this.life, 0, 1);
        c.fillStyle = this.color; c.beginPath(); c.arc(this.x, this.y, this.size, 0, Math.PI * 2); c.fill();
        c.restore();
      }
    }

    class HeartParticle {
      constructor(x, y, opts = {}) {
        this.x = x; this.y = y;
        this.size = opts.size || rand(14, 24);
        this.vx = opts.vx ?? rand(-5, 5);
        this.vy = opts.vy ?? rand(-9, -3);
        this.gravity = opts.gravity ?? 0.18;
        this.life = 1; this.decay = opts.decay || rand(0.007, 0.014);
        this.rotation = rand(-0.3, 0.3);
      }
      update() { this.vy += this.gravity; this.x += this.vx; this.y += this.vy; this.life -= this.decay; }
      draw(c) {
        c.save(); c.globalAlpha = clamp(this.life, 0, 1);
        c.translate(this.x, this.y); c.rotate(this.rotation);
        c.font = `${this.size}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('❤️', 0, 0);
        c.restore();
      }
    }

    return {
      confettiBurst(x, y, count = 90) {
        const items = [];
        for (let i = 0; i < count; i += 1) items.push(new ConfettiPiece(x, y));
        addParticles(items);
      },
      sparkleBurst(x, y, count = 10) {
        const items = [];
        for (let i = 0; i < count; i += 1) {
          const angle = rand(0, Math.PI * 2);
          items.push(new SparkParticle(x, y, angle, rand(1.5, 4.5), PALETTE[Math.floor(rand(0, PALETTE.length))]));
        }
        addParticles(items);
      },
      heartBurst(x, y, count = 24) {
        const items = [];
        for (let i = 0; i < count; i += 1) {
          const angle = rand(0, Math.PI * 2);
          const speed = rand(3, 8);
          items.push(new HeartParticle(x, y, { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, gravity: 0.2 }));
        }
        addParticles(items);
      },
    };
  };

  /* ---------------- API fetch helper (/api/*) ---------------- */

  const apiPost = async (path, body) => {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON response */ }
    return { ok: res.ok, status: res.status, data };
  };

  const apiGet = async (path) => {
    const res = await fetch(path);
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON response */ }
    return { ok: res.ok, status: res.status, data };
  };

  /* ---------------- FAQ accordion ---------------- */

  const initFaqAccordion = (selector = '.faq-item') => {
    document.querySelectorAll(selector).forEach((item) => {
      const question = item.querySelector('.faq-question');
      if (!question) return;
      question.setAttribute('role', 'button');
      question.setAttribute('tabindex', '0');
      const toggle = () => item.classList.toggle('open');
      question.addEventListener('click', toggle);
      question.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    });
  };

  /* ---------------- Analytics (Plausible, gated to the production domain) ---------------- */

  const PLAUSIBLE_DOMAIN = 'pookie.addify.ae';
  const GA_MEASUREMENT_ID = 'G-VJ85NV4XYR';
  const CONSENT_KEY = 'pookie-analytics-consent'; // 'granted' | 'denied' — unset means undecided

  const initAnalytics = () => {
    if (window.location.hostname !== PLAUSIBLE_DOMAIN) return;
    // Plausible is cookie-free (no personal data, no cross-site tracking) so
    // it doesn't need consent under GDPR/ePrivacy — it loads unconditionally,
    // same as before.
    const script = document.createElement('script');
    script.defer = true;
    script.dataset.domain = PLAUSIBLE_DOMAIN;
    script.src = 'https://plausible.io/js/script.js';
    document.head.appendChild(script);

    // Google Analytics sets tracking cookies and does need consent — it
    // only ever loads after an explicit Accept via the consent banner
    // below, never by default. See datenschutz.html / privacy.html for the
    // disclosure this banner is required by.
    initConsentBanner();
  };

  const loadGoogleAnalytics = () => {
    if (window.dataLayer) return; // already loaded this page view
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID);
    window.gtag = gtag;
  };

  const initConsentBanner = () => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (consent === 'granted') { loadGoogleAnalytics(); return; }
    if (consent === 'denied') return; // already declined — stay quiet, no banner every visit

    const banner = document.createElement('div');
    banner.className = 'cookie-consent';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie choice');
    banner.innerHTML = `
      <p class="cookie-consent-text">We'd like to use optional analytics cookies to see how people use Pookie. Declining just means we can't see your visit — everything else works the same either way. <a href="/privacy.html">Privacy policy</a></p>
      <div class="cookie-consent-actions">
        <button type="button" class="btn btn-ghost" id="cookie-decline">Decline</button>
        <button type="button" class="btn btn-primary" id="cookie-accept">Accept</button>
      </div>
    `;
    document.body.appendChild(banner);

    const dismiss = () => {
      banner.classList.add('is-leaving');
      setTimeout(() => banner.remove(), 300);
    };
    document.getElementById('cookie-accept').addEventListener('click', () => {
      localStorage.setItem(CONSENT_KEY, 'granted');
      loadGoogleAnalytics();
      dismiss();
    });
    document.getElementById('cookie-decline').addEventListener('click', () => {
      localStorage.setItem(CONSENT_KEY, 'denied');
      dismiss();
    });
  };

  const track = (eventName) => {
    if (typeof window.plausible === 'function') window.plausible(eventName);
  };

  return {
    prefersReducedMotion,
    isCoarsePointer,
    rand,
    clamp,
    vibrate,
    initTheme,
    toggleTheme,
    initChrome,
    initCursor,
    initMagnetic,
    initTilt,
    initParticles,
    initReveal,
    initFX,
    apiPost,
    apiGet,
    initFaqAccordion,
    initAnalytics,
    initConsentBanner,
    track,
  };
})();
