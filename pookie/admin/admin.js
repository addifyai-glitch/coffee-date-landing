/* ==========================================================================
   Admin dashboard — gated by Supabase Auth.
   Uses the full supabase-js client (not the lightweight REST helpers in
   common.js) because reading data requires an authenticated session, which
   supabase-js manages automatically after sign-in.
   ========================================================================== */

(() => {
  'use strict';

  Shared.initTheme();
  Shared.initChrome({ pookieBase: '../', rootBase: '../../', variant: 'pookie' });
  Shared.initCursor();

  const loginWrap = document.getElementById('login-wrap');
  const dashboard = document.getElementById('dashboard');
  const configWarning = document.getElementById('config-warning');

  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
    configWarning.textContent = 'Supabase isn’t configured yet in config.js — the dashboard has nothing to connect to.';
    document.getElementById('login-submit').disabled = true;
    return;
  }

  const client = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

  /* ---------------- Auth ---------------- */

  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const loginSubmit = document.getElementById('login-submit');
  const logoutBtn = document.getElementById('logout-btn');

  const showDashboard = () => {
    loginWrap.classList.add('hidden');
    dashboard.classList.remove('hidden');
    loadDashboard();
  };

  const showLogin = () => {
    dashboard.classList.add('hidden');
    loginWrap.classList.remove('hidden');
  };

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginSubmit.disabled = true;
    loginSubmit.textContent = 'Signing in...';
    loginError.classList.remove('show');

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    const { error } = await client.auth.signInWithPassword({ email, password });

    loginSubmit.disabled = false;
    loginSubmit.textContent = 'Log in';

    if (error) {
      loginError.textContent = error.message;
      loginError.classList.add('show');
      return;
    }
    showDashboard();
  });

  logoutBtn.addEventListener('click', async () => {
    await client.auth.signOut();
    showLogin();
  });

  client.auth.getSession().then(({ data }) => {
    if (data.session) showDashboard();
  });

  /* ---------------- Chart rendering ---------------- */

  const renderBarChart = (containerId, counts, { limit = 8 } = {}) => {
    const container = document.getElementById(containerId);
    const entries = Object.entries(counts)
      .filter(([label]) => label && label !== 'null' && label !== 'undefined')
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    if (!entries.length) {
      container.innerHTML = '<p class="stat-label">Not enough data yet.</p>';
      return;
    }

    const max = Math.max(...entries.map(([, v]) => v));
    container.innerHTML = entries.map(([label, value]) => `
      <div class="bar-row">
        <span class="bar-label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${Math.max(6, (value / max) * 100)}%"></span></span>
        <span class="bar-value">${value}</span>
      </div>
    `).join('');
  };

  const renderTextList = (containerId, items) => {
    const container = document.getElementById(containerId);
    const filtered = items.filter(Boolean);
    if (!filtered.length) {
      container.innerHTML = '<p class="stat-label">Nothing submitted yet.</p>';
      return;
    }
    container.innerHTML = filtered.slice(0, 30).map((text) => `<div class="text-list-item">${escapeHtml(text)}</div>`).join('');
  };

  const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  const countBy = (rows, key) => {
    const counts = {};
    rows.forEach((row) => {
      const value = row[key];
      if (!value) return;
      counts[value] = (counts[value] || 0) + 1;
    });
    return counts;
  };

  const countByArrayField = (rows, key) => {
    const counts = {};
    rows.forEach((row) => {
      const arr = row[key];
      if (!Array.isArray(arr)) return;
      arr.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
    });
    return counts;
  };

  /* ---------------- Data loading ---------------- */

  let waitlistRowsCache = [];

  const loadDashboard = async () => {
    const [pageViewsRes, waitlistRes, responsesRes, vibeEventsRes] = await Promise.all([
      client.from('page_views').select('session_id'),
      client.from('waitlist_signups').select('*').order('created_at', { ascending: false }),
      client.from('responses').select('*').order('created_at', { ascending: false }),
      client.from('demo_events').select('value').eq('event_type', 'vibe_pick'),
    ]);

    const pageViews = pageViewsRes.data || [];
    const waitlistRows = waitlistRes.data || [];
    const responseRows = responsesRes.data || [];
    const vibeEvents = vibeEventsRes.data || [];
    waitlistRowsCache = waitlistRows;

    document.getElementById('stat-pageviews').textContent = pageViews.length;
    document.getElementById('stat-unique').textContent = new Set(pageViews.map((r) => r.session_id)).size;
    document.getElementById('stat-confirmations').textContent = responseRows.length;
    document.getElementById('stat-waitlist').textContent = waitlistRows.length;

    renderBarChart('chart-would-use', countBy(waitlistRows, 'would_use'));
    renderBarChart('chart-name-opinion', countBy(waitlistRows, 'name_opinion'));
    renderBarChart('chart-activities', countBy(responseRows, 'activity'));
    renderBarChart('chart-vibes', countBy(vibeEvents, 'value'));
    renderBarChart('chart-countries', countBy(waitlistRows, 'country'));
    renderBarChart('chart-age', countBy(waitlistRows, 'age_group'));
    renderBarChart('chart-features', countBy(waitlistRows, 'favorite_feature'));
    renderBarChart('chart-would-pay', countBy(waitlistRows, 'would_pay'));

    renderTextList('list-concerns', waitlistRows.map((r) => r.biggest_concern));
    renderTextList('list-suggestions', waitlistRows.map((r) => r.suggestions));

    const waitlistTbody = document.querySelector('#waitlist-table tbody');
    waitlistTbody.innerHTML = waitlistRows.slice(0, 50).map((r) => `
      <tr>
        <td>${new Date(r.created_at).toLocaleDateString()}</td>
        <td>${escapeHtml(r.first_name || '—')}</td>
        <td>${escapeHtml(r.email || '—')}</td>
        <td>${escapeHtml(r.country || '—')}</td>
        <td>${escapeHtml(r.age_group || '—')}</td>
        <td>${escapeHtml((r.interests || []).join(', ') || '—')}</td>
        <td>${escapeHtml(r.would_use || '—')}</td>
        <td>${escapeHtml(r.name_opinion || '—')}</td>
      </tr>
    `).join('');

    const responsesTbody = document.querySelector('#responses-table tbody');
    responsesTbody.innerHTML = responseRows.slice(0, 50).map((r) => `
      <tr>
        <td>${new Date(r.created_at).toLocaleDateString()}</td>
        <td>${escapeHtml(r.name || '—')}</td>
        <td>${escapeHtml(r.activity || '—')}</td>
        <td>${escapeHtml(r.preferred_date || '—')} ${escapeHtml(r.preferred_time || '')}</td>
        <td>${escapeHtml(r.city || '—')}</td>
      </tr>
    `).join('');
  };

  document.getElementById('refresh-btn').addEventListener('click', loadDashboard);

  /* ---------------- CSV export ---------------- */

  document.getElementById('export-btn').addEventListener('click', () => {
    if (!waitlistRowsCache.length) return;
    const columns = Object.keys(waitlistRowsCache[0]);
    const csvRows = [columns.join(',')];
    waitlistRowsCache.forEach((row) => {
      csvRows.push(columns.map((col) => {
        let val = row[col];
        if (Array.isArray(val)) val = val.join('; ');
        if (val === null || val === undefined) val = '';
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pookie-waitlist-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
})();
