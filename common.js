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
    { label: 'How it works', href: '/#how-it-works' },
    { label: 'Invite someone', href: '/#invite' },
    { label: 'Waitlist', href: '/#waitlist' },
    { label: 'FAQ', href: '/faq.html' },
  ];

  const buildNav = () => {
    const linksHtml = NAV_LINKS.map((l) => `<li><a href="${l.href}">${l.label}</a></li>`).join('');
    return `
      <a href="/" class="nav-brand"><span aria-hidden="true">☕</span> Pookie</a>
      <ul class="nav-links">${linksHtml}</ul>
      <div class="nav-actions">
        <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Toggle dark mode">🌙</button>
        <button class="nav-menu-toggle" id="nav-menu-toggle" type="button" aria-label="Toggle menu">☰</button>
      </div>
    `;
  };

  const buildFooter = () => `
    <p class="footer-tagline">Pookie ☕</p>
    <p class="footer-sub">Meet for coffee. Actually meet.</p>
    <ul class="footer-links">
      <li><a href="/about.html">About</a></li>
      <li><a href="/faq.html">FAQ</a></li>
      <li><a href="/contact.html">Contact</a></li>
      <li><a href="/datenschutz.html">Datenschutz</a></li>
      <li><a href="/impressum.html">Impressum</a></li>
    </ul>
    <p class="footer-credit">© <span id="footer-year"></span> Pookie. Made for real meetups, not endless scrolling.</p>
  `;

  const initChrome = () => {
    const navEl = document.getElementById('site-nav');
    if (navEl) {
      navEl.innerHTML = buildNav();
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

  const initParticles = (containerId = 'particles') => {
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

    const PALETTE = ['#C8552D', '#8A9A7B', '#F4EBDD', '#2B1D16'];

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

  const initAnalytics = () => {
    if (window.location.hostname !== PLAUSIBLE_DOMAIN) return;
    const script = document.createElement('script');
    script.defer = true;
    script.dataset.domain = PLAUSIBLE_DOMAIN;
    script.src = 'https://plausible.io/js/script.js';
    document.head.appendChild(script);
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
    track,
  };
})();
