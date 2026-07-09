/* ==========================================================================
   Shared foundation — loaded on every page (vibe, pookie, admin, content).
   Theme toggle, nav/footer injection, cursor, magnetic buttons, ambient
   particles, scroll-reveal, the FX canvas, Supabase REST helpers, EmailJS,
   and lightweight privacy-friendly page-view analytics.
   Depends on window.CONFIG from config.js.
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

  const POOKIE_NAV_LINKS = [
    { label: 'Philosophy', hash: '#philosophy' },
    { label: 'Features', hash: '#features' },
    { label: 'Vibe Mode', hash: '#vibe-mode' },
    { label: 'How it works', hash: '#demo' },
    { label: 'Waitlist', hash: '#waitlist' },
  ];

  const buildNav = ({ pookieBase, rootBase, variant }) => {
    const brandHref = variant === 'vibe' ? (rootBase || './') : `${pookieBase}index.html`;
    const brandMark = variant === 'vibe' ? '😎' : '💗';
    const brandLabel = variant === 'vibe' ? "Let's Vibe" : 'Pookie';

    const links = variant === 'vibe'
      ? [{ label: 'Pookie ✨', href: `${pookieBase}index.html` }]
      : [
          ...POOKIE_NAV_LINKS.map((l) => ({ label: l.label, href: `${pookieBase}index.html${l.hash}` })),
          { label: 'FAQ', href: `${pookieBase}faq.html` },
        ];

    const linksHtml = links.map((l) => `<li><a href="${l.href}">${l.label}</a></li>`).join('');

    return `
      <a href="${brandHref}" class="nav-brand"><span class="nav-brand-mark">${brandMark}</span> ${brandLabel}</a>
      <ul class="nav-links">${linksHtml}</ul>
      <div class="nav-actions">
        <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Toggle dark mode">🌙</button>
        <button class="nav-menu-toggle" id="nav-menu-toggle" type="button" aria-label="Toggle menu">☰</button>
      </div>
    `;
  };

  const buildFooter = ({ pookieBase }) => `
    <p class="footer-tagline">Built with ❤️ — Currently in Early Access</p>
    <p class="footer-sub">Help shape the future of real-world social discovery. Good vibes only.</p>
    <ul class="footer-links">
      <li><a href="${pookieBase}about.html">About</a></li>
      <li><a href="${pookieBase}privacy.html">Privacy</a></li>
      <li><a href="${pookieBase}terms.html">Terms</a></li>
      <li><a href="${pookieBase}contact.html">Contact</a></li>
      <li><a href="${pookieBase}index.html#waitlist">Waitlist</a></li>
      <li><a href="${pookieBase}faq.html">FAQ</a></li>
    </ul>
    <p class="footer-credit">© <span id="footer-year"></span> Pookie Labs. Made for humans, not algorithms.</p>
  `;

  const initChrome = (opts) => {
    const options = { pookieBase: './', rootBase: './', variant: 'pookie', minimalNav: false, ...opts };
    const navEl = document.getElementById('site-nav');
    if (navEl) {
      navEl.innerHTML = buildNav(options);
      if (options.minimalNav) navEl.classList.add('nav-minimal');
      const menuToggle = document.getElementById('nav-menu-toggle');
      if (menuToggle) menuToggle.addEventListener('click', () => navEl.classList.toggle('nav-open'));
      const themeBtn = document.getElementById('theme-toggle');
      if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
    }
    const footerEl = document.getElementById('site-footer');
    if (footerEl) {
      footerEl.innerHTML = buildFooter(options);
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
    const hoverTargets = 'button, a, input, select, textarea, .field, .chip, .feature-card, .vibe-chip, .demo-flow-item';
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
    const strength = 0.28;
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

  /* ---------------- Ambient particles ---------------- */

  const initParticles = (containerId = 'particles') => {
    const layer = document.getElementById(containerId);
    if (!layer || prefersReducedMotion) return;
    const spawn = () => {
      const el = document.createElement('span');
      el.className = 'particle';
      const size = rand(3, 7);
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.left = `${rand(0, 100)}vw`;
      el.style.bottom = '-4vh';
      el.style.setProperty('--drift', `${rand(-60, 60)}px`);
      el.style.animationDuration = `${rand(12, 22)}s`;
      layer.appendChild(el);
      setTimeout(() => el.remove(), 23000);
    };
    setInterval(spawn, 900);
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

  /* ---------------- FX canvas (confetti / hearts / sparkles) ---------------- */

  const initFX = (canvasId = 'fx-canvas') => {
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

    const MAX_PARTICLES = 380;
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

    class ConfettiPiece {
      constructor(x, y) {
        this.x = x; this.y = y;
        this.w = rand(6, 11); this.h = rand(8, 14);
        this.color = ['#ff6f91', '#c96bd8', '#7c6bf0', '#ffb17a', '#ffffff'][Math.floor(rand(0, 5))];
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

    return {
      confettiBurst(x, y, count = 100) {
        const items = [];
        for (let i = 0; i < count; i += 1) items.push(new ConfettiPiece(x, y));
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
      sparkleBurst(x, y, count = 10) {
        const items = [];
        for (let i = 0; i < count; i += 1) {
          const angle = rand(0, Math.PI * 2);
          items.push(new SparkParticle(x, y, angle, rand(1.5, 4.5), ['#ff6f91', '#c96bd8', '#7c6bf0'][Math.floor(rand(0, 3))]));
        }
        addParticles(items);
      },
    };
  };

  /* ---------------- Supabase REST helpers ---------------- */

  const supabaseReady = () => Boolean(window.CONFIG && CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);

  const supabaseHeaders = () => ({
    'Content-Type': 'application/json',
    apikey: CONFIG.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
  });

  const supabaseInsert = async (table, rows, { returnRepresentation = false } = {}) => {
    if (!supabaseReady()) return null;
    const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...supabaseHeaders(), Prefer: returnRepresentation ? 'return=representation' : 'return=minimal' },
      body: JSON.stringify(rows),
    });
    if (!res.ok) throw new Error(`Supabase insert into ${table} failed with status ${res.status}`);
    return returnRepresentation ? res.json() : null;
  };

  const supabaseUpdate = async (table, id, patch) => {
    if (!supabaseReady()) return null;
    const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...supabaseHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`Supabase update on ${table} failed with status ${res.status}`);
  };

  /* ---------------- EmailJS ---------------- */

  const initEmailJS = () => {
    if (window.emailjs && window.CONFIG && CONFIG.EMAILJS_PUBLIC_KEY) {
      emailjs.init({ publicKey: CONFIG.EMAILJS_PUBLIC_KEY });
    }
  };

  const sendEmail = async (templateId, params) => {
    if (!window.emailjs || !window.CONFIG || !CONFIG.EMAILJS_SERVICE_ID || !templateId) return;
    await emailjs.send(CONFIG.EMAILJS_SERVICE_ID, templateId, params);
  };

  /* ---------------- Lightweight, privacy-friendly analytics ---------------- */

  const SESSION_KEY = 'pookie-session-id';

  const getSessionId = () => {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  };

  const logPageView = (page) => {
    if (!supabaseReady()) return;
    supabaseInsert('page_views', [{ page, session_id: getSessionId() }]).catch(() => {});
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
    initParticles,
    initReveal,
    initFX,
    supabaseReady,
    supabaseInsert,
    supabaseUpdate,
    initEmailJS,
    sendEmail,
    getSessionId,
    logPageView,
    initFaqAccordion,
  };
})();
