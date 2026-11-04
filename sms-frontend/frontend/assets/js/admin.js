/* ============================================================
   SMS SUMMIT 2026 — Organizer portal logic
   Auth gate, KPIs, charts, table, filters, detail drawer,
   spouse invitations, audit trail, CSV export.
   ============================================================ */
(function () {
  'use strict';

  const UI = window.SMSUI;
  const API = window.SMSApi;
  const CFG = window.SMS_CONFIG;
  const { $, $$, toast, copy, escapeHtml, titleCase, initials, formatDate, formatDateTime, timeAgo, renderQR } = UI;

  const loginScreen = $('#login-screen');
  const app = $('#admin-app');
  const isMock = API.isMock();

  const state = {
    view: 'dashboard',
    page: 1,
    per_page: 10,
    q: '',
    filters: { gender: '', marital_status: '', linked: '', status: '' },
    sort: 'created_at',
    dir: 'desc',
    total: 0,
    pages: 1,
    detailId: null
  };

  /* ============================================================
     AUTH
     ============================================================ */
  const loginForm = $('[data-login-form]');

  if (isMock) {
    const creds = $('[data-demo-creds]');
    if (creds) creds.hidden = false;
    const reset = $('[data-reset-demo]');
    if (reset) reset.hidden = false;
  }

  async function boot() {
    if (!API.Session.token) { showLogin(); return; }
    try {
      const me = await API.me();
      enterApp(me);
    } catch (err) {
      API.Session.clear();
      showLogin();
      if (err.code !== 'not_authenticated') toast(err.message || 'Please sign in again.', { type: 'err' });
    }
  }

  function showLogin() {
    loginScreen.classList.remove('hidden');
    app.classList.add('hidden');
  }

  function enterApp(me) {
    loginScreen.classList.add('hidden');
    app.classList.remove('hidden');
    $('[data-user-name]').textContent = me.name || 'Organizer';
    $('[data-user-role]').textContent = (me.role || 'organizer').toUpperCase();
    $('[data-user-initials]').textContent = initials(me.name || 'Organizer');
    const role = (me.role || '').toLowerCase();
    // non-admins cannot delete
    document.body.dataset.role = role;
    loadDashboard();
    loadRegistrations();
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginForm.elements.email.value.trim();
    const password = loginForm.elements.password.value;
    const remember = loginForm.elements.remember.checked;
    const errEl = $('[data-login-error]');
    const btn = $('[data-login-btn]');
    const label = $('[data-login-label]');

    errEl.textContent = '';
    if (!email || !password) { errEl.textContent = 'Enter your email and password.'; return; }

    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');
    if (label) label.textContent = 'Signing in…';

    try {
      const session = await API.login(email, password, remember);
      enterApp(session);
      toast(`Welcome back, ${session.name || 'organizer'}.`, { type: 'ok', title: 'Signed in' });
    } catch (err) {
      errEl.textContent = err.message || 'Sign-in failed.';
      loginForm.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
        { duration: 340, easing: 'ease-in-out' }
      );
    } finally {
      btn.disabled = false;
      btn.removeAttribute('aria-disabled');
      if (label) label.textContent = 'Sign in';
    }
  });

  $('[data-logout]') && $('[data-logout]').addEventListener('click', async () => {
    await API.logout();
    showLogin();
    toast('Signed out.', { type: 'info' });
  });

  $('[data-reset-demo]') && $('[data-reset-demo]').addEventListener('click', async () => {
    if (!confirm('Reset all demo registrations back to the seeded set?')) return;
    API.resetDemo();
    API.Session.clear();
    showLogin();
    toast('Demo data reset. Sign in again to continue.', { type: 'ok' });
  });

  /* ============================================================
     NAVIGATION
     ============================================================ */
  const titles = {
    dashboard: ['Overview', 'Live registration metrics for the Singles & Married Summit 2026.'],
    registrations: ['Registrations', 'Search, filter and manage every attendee record.'],
    invites: ['Spouse links', 'Invitation tokens and their acceptance status.'],
    audit: ['Activity log', 'Every organizer action, newest first.']
  };

  $$('[data-view]').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));

  function setView(view) {
    state.view = view;
    $$('[data-view]').forEach(b => b.classList.toggle('is-active', b.dataset.view === view));
    $$('[data-view-panel]').forEach(p => p.classList.toggle('hidden', p.dataset.viewPanel !== view));
    const [t, s] = titles[view] || ['', ''];
    $('[data-page-title]').textContent = t;
    $('[data-page-sub]').textContent = s;
    document.body.classList.remove('admin-nav-open');
    if (view === 'dashboard') loadDashboard();
    if (view === 'registrations') loadRegistrations();
    if (view === 'invites') loadInvites();
    if (view === 'audit') loadAudit();
  }

  const burger = $('[data-admin-burger]');
  if (burger) burger.addEventListener('click', () => document.body.classList.toggle('admin-nav-open'));

  /* ============================================================
     DASHBOARD
     ============================================================ */
  async function loadDashboard() {
    try {
      const s = await API.stats();
      $('[data-kpi="total"]').textContent = s.total;
      $('[data-kpi="checked_in"]').textContent = s.checked_in;
      $('[data-kpi="linked"]').textContent = s.linked_pairs;
      $('[data-kpi="pending"]').textContent = s.pending_invites;

      paintBars(s.by_day || []);
      paintDonut(s.male, s.female);
      paintMarital(s);
      paintOccupations(s.by_occupation || []);
    } catch (err) {
      toast(err.message || 'Could not load metrics.', { type: 'err' });
    }
  }

  function paintBars(days) {
    const host = $('[data-bars]');
    if (!host) return;
    const max = Math.max(1, ...days.map(d => d.count));
    host.innerHTML = days.map((d, i) => `
      <div class="bar" title="${d.count} registration${d.count === 1 ? '' : 's'} on ${d.label}">
        <div class="bar__fill" style="--h:${Math.max(4, (d.count / max) * 100)}%;--i:${i}">
          <span>${d.count}</span>
        </div>
        <small>${escapeHtml(d.label.split(' ')[0])}</small>
      </div>`).join('');
  }

  function paintDonut(male, female) {
    const total = (male || 0) + (female || 0) || 1;
    const C = 2 * Math.PI * 46;
    const mArc = (male / total) * C;
    const fArc = (female / total) * C;
    const maleEl = $('[data-arc="male"]');
    const femaleEl = $('[data-arc="female"]');
    if (maleEl) maleEl.setAttribute('stroke-dasharray', `${mArc} ${C}`);
    if (femaleEl) {
      femaleEl.setAttribute('stroke-dasharray', `${fArc} ${C}`);
      femaleEl.setAttribute('stroke-dashoffset', `${-mArc}`);
    }
    $('[data-donut-total]').textContent = male + female;
    $('[data-legend="male"]').textContent = male;
    $('[data-legend="female"]').textContent = female;
  }

  function paintMarital(s) {
    const host = $('[data-marital-legend]');
    if (!host) return;
    const rows = [
      ['Single', s.single, '#e8c9a8'],
      ['Married', s.married, '#d0202f']
    ];
    const total = (s.single || 0) + (s.married || 0) || 1;
    host.innerHTML = rows.map(([label, value, color]) => `
      <div><span><i style="background:${color}"></i>${label}</span><b>${value ?? 0} <span style="color:var(--white-40);font-weight:400">· ${Math.round(((value || 0) / total) * 100)}%</span></b></div>`).join('') +
      `<div><span><i style="background:#8f8f8f"></i>Cancelled</span><b>${s.cancelled ?? 0}</b></div>
       <div style="margin-top:.35rem;padding-top:.55rem;border-top:1px solid var(--white-10)"><span style="color:var(--white-40)">Checked in</span><b>${s.checked_in ?? 0} / ${s.total ?? 0}</b></div>`;
  }

  function paintOccupations(list) {
    const host = $('[data-occupation-legend]');
    if (!host) return;
    if (!list.length) {
      host.innerHTML = '<div style="color:var(--white-40);font-size:.8rem">No data yet.</div>';
      return;
    }
    host.innerHTML = list.slice(0, 6).map((o, i) => `
      <div><span><i style="background:hsl(${350 - i * 8} 70% ${58 - i * 5}%)"></i>${escapeHtml(o.label)}</span><b>${o.count}</b></div>`).join('');
  }

  /* ============================================================
     REGISTRATIONS TABLE
     ============================================================ */
  const tbody = $('[data-tbody]');

  function loadRegistrations() {
    const params = Object.assign(
      { page: state.page, per_page: state.per_page, q: state.q, sort: state.sort, dir: state.dir },
      state.filters
    );
    API.listRegistrations(params).then(res => {
      state.total = res.total;
      state.pages = res.pages;
      renderRows(res.items);
      renderPager();
      $('[data-result-count]').textContent =
        res.total === 0 ? 'No registrations match'
        : `Showing ${(res.page - 1) * res.per_page + 1}–${Math.min(res.total, res.page * res.per_page)} of ${res.total}`;
    }).catch(err => {
      if (err.status === 401) { showLogin(); return; }
      toast(err.message || 'Could not load registrations.', { type: 'err' });
    });
  }

  function statusTag(status) {
    if (status === 'checked_in') return '<span class="tag tag--ok">Checked in</span>';
    if (status === 'cancelled') return '<span class="tag">Cancelled</span>';
    return '<span class="tag tag--pending">Registered</span>';
  }

  function renderRows(items) {
    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="7">
        <div class="admin-empty">
          <svg><use href="#i-users" /></svg>
          <b>No registrations here yet</b>
          <p>Try a different search or filter.</p>
        </div></td></tr>`;
      return;
    }
    tbody.innerHTML = items.map(r => `
      <tr tabindex="0" data-id="${escapeHtml(r.id)}" data-reg="${escapeHtml(r.registration_id)}">
        <td>
          <div class="td-name">
            <div class="avatar">${escapeHtml(initials(r.full_name))}</div>
            <div>
              <b>${escapeHtml(r.full_name)}</b>
              <span>${escapeHtml(r.email)}</span>
            </div>
          </div>
        </td>
        <td><span class="td-id">${escapeHtml(r.registration_id)}</span></td>
        <td><span class="tag tag--${r.gender === 'male' ? 'm' : 'f'}">${r.gender === 'male' ? 'M' : 'F'}</span></td>
        <td><span class="tag tag--${r.marital_status}">${titleCase(r.marital_status)}</span></td>
        <td>${r.spouse ? `<span class="tag tag--link">${escapeHtml(r.spouse.full_name.split(' ')[0])}</span>` : '<span class="tag">—</span>'}</td>
        <td class="muted" style="font-size:.78rem;white-space:nowrap">${formatDate(r.created_at, { day: 'numeric', month: 'short' })}</td>
        <td>${statusTag(r.status)}</td>
      </tr>`).join('');

    $$('tr[data-id]', tbody).forEach(tr => {
      const open = () => openDetail(tr.dataset.reg);
      tr.addEventListener('click', open);
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
    });
  }

  function renderPager() {
    const host = $('[data-pager]');
    if (!host) return;
    const pages = state.pages;
    if (pages <= 1) { host.innerHTML = ''; return; }
    const btn = (label, page, opts) => {
      opts = opts || {};
      return `<button type="button" data-page="${page}" ${opts.disabled ? 'disabled' : ''} class="${opts.active ? 'is-active' : ''}">${label}</button>`;
    };
    let html = btn('<svg style="width:12px;height:12px;stroke:currentColor;fill:none" viewBox="0 0 24 24"><use href="#i-chevron-left"/></svg>', state.page - 1, { disabled: state.page === 1 });
    const windowSize = 5;
    let start = Math.max(1, state.page - 2);
    let end = Math.min(pages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    if (start > 1) html += btn('1', 1, {}) + (start > 2 ? '<button disabled>…</button>' : '');
    for (let p = start; p <= end; p++) html += btn(p, p, { active: p === state.page });
    if (end < pages) html += (end < pages - 1 ? '<button disabled>…</button>' : '') + btn(pages, pages);
    html += btn('<svg style="width:12px;height:12px;stroke:currentColor;fill:none" viewBox="0 0 24 24"><use href="#i-chevron-right"/></svg>', state.page + 1, { disabled: state.page === pages });
    host.innerHTML = html;
    $$('button[data-page]', host).forEach(b => {
      b.addEventListener('click', () => {
        const p = +b.dataset.page;
        if (p >= 1 && p <= state.pages) { state.page = p; loadRegistrations(); }
      });
    });
  }

  /* search + filters (debounced) */
  let searchTimer;
  const searchInput = $('[data-search]');
  if (searchInput) searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.q = searchInput.value.trim();
      state.page = 1;
      loadRegistrations();
    }, 320);
  });
  $$('[data-filter]').forEach(sel => sel.addEventListener('change', () => {
    state.filters[sel.dataset.filter] = sel.value;
    state.page = 1;
    loadRegistrations();
  }));
  $$('[data-sort]').forEach(th => th.addEventListener('click', () => {
    const key = th.dataset.sort;
    if (state.sort === key) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
    else { state.sort = key; state.dir = 'asc'; }
    $$('[data-sort]').forEach(t => { t.classList.remove('th-sorted'); t.removeAttribute('data-dir'); });
    th.classList.add('th-sorted');
    th.setAttribute('data-dir', state.dir);
    loadRegistrations();
  }));
  $('[data-refresh]') && $('[data-refresh]').addEventListener('click', () => {
    loadDashboard(); loadRegistrations();
    toast('Refreshed.', { type: 'info', duration: 1600 });
  });

  /* export */
  $('[data-export]') && $('[data-export]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.setAttribute('aria-disabled', 'true');
    try {
      if (isMock) {
        const rows = await API.exportCSV();
        const header = ['registration_id', 'full_name', 'email', 'phone', 'gender', 'marital_status', 'occupation', 'age_range', 'city', 'status', 'spouse_registration_id', 'created_at'];
        const csv = [header.join(',')].concat(rows.map(r => [
          r.registration_id, r.full_name, r.email, r.phone, r.gender, r.marital_status,
          r.occupation, r.age_range, r.city, r.status, r.spouse ? r.spouse.registration_id : '', r.created_at
        ].map(v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`).join(','))).join('\n');
        window.downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'sms26-registrations.csv');
      } else {
        await API.exportCSV();
      }
      toast('Registrations exported.', { type: 'ok' });
    } catch (err) {
      toast(err.message || 'Export failed.', { type: 'err' });
    } finally {
      btn.removeAttribute('aria-disabled');
    }
  });

  /* ============================================================
     DETAIL DRAWER
     ============================================================ */
  const detail = $('[data-detail]');
  const detailBody = $('[data-detail-body]');

  async function openDetail(regId) {
    try {
      const r = await API.getRegistrationAdmin(regId);
      state.detailId = r.id;
      paintDetail(r);
      detail.classList.add('is-open');
      detail.setAttribute('aria-hidden', 'false');
      document.body.classList.add('is-locked');
    } catch (err) {
      toast(err.message || 'Could not load that registration.', { type: 'err' });
    }
  }

  function closeDetail() {
    detail.classList.remove('is-open');
    detail.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-locked');
    state.detailId = null;
  }
  $('[data-detail-close]') && $('[data-detail-close]').addEventListener('click', closeDetail);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetail(); });

  function paintDetail(r) {
    const canDelete = document.body.dataset.role === 'admin';
    detailBody.innerHTML = `
      <div class="detail-hero">
        <div class="avatar">${escapeHtml(initials(r.full_name))}</div>
        <div>
          <b>${escapeHtml(r.full_name)}</b>
          <span>${escapeHtml(r.registration_id)}</span>
        </div>
      </div>

      <div class="detail-status-row">
        ${statusTag(r.status)}
        <span class="tag tag--${r.gender === 'male' ? 'm' : 'f'}">${titleCase(r.gender)}</span>
        <span class="tag tag--${r.marital_status}">${titleCase(r.marital_status)}</span>
        ${r.spouse ? '<span class="tag tag--link">Linked</span>' : ''}
      </div>

      <div class="detail-section">
        <h4>QR ticket</h4>
        <div class="detail-qr">
          <canvas data-detail-qr width="264" height="264"></canvas>
          <small>SCAN TO CHECK IN</small>
        </div>
      </div>

      <div class="detail-section">
        <h4>Contact</h4>
        <div class="detail-list">
          <div><span>Email</span><b>${escapeHtml(r.email)}</b></div>
          <div><span>Phone</span><b>${escapeHtml(r.phone)}</b></div>
          <div><span>City</span><b>${escapeHtml(r.city || '—')}</b></div>
          <div><span>Emergency</span><b>${r.emergency_contact_name ? escapeHtml(r.emergency_contact_name) + ' · ' + escapeHtml(r.emergency_contact_phone || '') : '—'}</b></div>
        </div>
      </div>

      <div class="detail-section">
        <h4>Registration</h4>
        <div class="detail-list">
          <div><span>Field</span><b>${escapeHtml(r.occupation)}</b></div>
          <div><span>Age range</span><b>${escapeHtml(r.age_range)}</b></div>
          <div><span>Registered</span><b>${formatDateTime(r.created_at)}</b></div>
          <div><span>Updated</span><b>${formatDateTime(r.updated_at)}</b></div>
          <div><span>Expectations</span><b>${escapeHtml(r.expectations || '—')}</b></div>
        </div>
      </div>

      ${r.spouse ? `
      <div class="detail-section">
        <h4>Linked spouse</h4>
        <div class="spouse-link-card">
          <svg viewBox="0 0 24 24"><use href="#i-heart-fill"/></svg>
          <div>
            <b>${escapeHtml(r.spouse.full_name)}</b>
            <span>${escapeHtml(r.spouse.registration_id)} · separate ticket &amp; QR</span>
          </div>
        </div>
      </div>` : `
      <div class="detail-section">
        <h4>Linked spouse</h4>
        <div class="spouse-link-card" style="background:rgba(255,255,255,.03);box-shadow:inset 0 0 0 1px var(--white-10)">
          <svg viewBox="0 0 24 24" style="fill:var(--white-40)"><use href="#i-heart"/></svg>
          <div><b>Not linked</b><span>No accepted spouse invitation yet.</span></div>
        </div>
      </div>`}

      <div class="detail-actions">
        <button class="btn btn--sm" type="button" data-detail-checkin>${r.status === 'checked_in' ? 'Undo check-in' : 'Check in'}</button>
        <button class="btn btn--sm btn--ghost" type="button" data-detail-cancel>${r.status === 'cancelled' ? 'Reactivate' : 'Cancel'}</button>
        <button class="btn btn--sm btn--ghost" type="button" data-detail-copy><svg><use href="#i-copy"/></svg> Copy ID</button>
        ${canDelete ? '<button class="btn btn--sm btn--ghost" type="button" data-detail-delete style="color:#ffb3b3"><svg><use href="#i-trash"/></svg> Delete</button>' : ''}
      </div>
      <p class="tiny muted">Deletes are permanent. Only admins can delete registrations.</p>
    `;

    const qrCanvas = $('[data-detail-qr]', detailBody);
    if (qrCanvas) renderQR(qrCanvas, r.qr_payload || ('SMS26|' + r.registration_id), { width: 300, margin: 1, dark: '#4a070b', light: '#ffffff' });

    const act = async (status, successMsg) => {
      try {
        const updated = await API.updateStatus(r.registration_id, status);
        paintDetail(updated);
        loadDashboard();
        loadRegistrations();
        toast(successMsg, { type: 'ok' });
      } catch (err) {
        toast(err.message || 'Action failed.', { type: 'err' });
      }
    };

    $('[data-detail-checkin]', detailBody).addEventListener('click', () => {
      act(r.status === 'checked_in' ? 'registered' : 'checked_in',
        r.status === 'checked_in' ? 'Check-in reversed.' : 'Attendee checked in.');
    });
    $('[data-detail-cancel]', detailBody).addEventListener('click', () => {
      act(r.status === 'cancelled' ? 'registered' : 'cancelled',
        r.status === 'cancelled' ? 'Registration reactivated.' : 'Registration cancelled.');
    });
    $('[data-detail-copy]', detailBody).addEventListener('click', () => copy(r.registration_id, 'Registration ID copied'));

    const del = $('[data-detail-delete]', detailBody);
    if (del) del.addEventListener('click', async () => {
      if (!confirm(`Permanently delete ${r.full_name}'s registration?`)) return;
      try {
        await API.deleteRegistration(r.registration_id);
        closeDetail();
        loadDashboard();
        loadRegistrations();
        toast('Registration deleted.', { type: 'ok' });
      } catch (err) {
        toast(err.message || 'Delete failed.', { type: 'err' });
      }
    });
  }

  /* ============================================================
     INVITES
     ============================================================ */
  async function loadInvites() {
    const body = $('[data-invites-body]');
    if (!body) return;
    body.innerHTML = '<tr><td colspan="6" class="muted" style="padding:1.4rem">Loading invitations…</td></tr>';
    try {
      const rows = await API.invites();
      if (!rows.length) {
        body.innerHTML = '<tr><td colspan="6"><div class="admin-empty"><svg><use href="#i-link"/></svg><b>No invitations yet</b><p>Married attendees can create one from their ticket page.</p></div></td></tr>';
        return;
      }
      const tagFor = (s) => s === 'accepted' ? '<span class="tag tag--ok">Accepted</span>'
        : s === 'pending' ? '<span class="tag tag--pending">Pending</span>'
        : s === 'expired' ? '<span class="tag">Expired</span>'
        : '<span class="tag">Revoked</span>';
      body.innerHTML = rows.map(i => `
        <tr>
          <td><span class="token-cell">${escapeHtml(i.token)}
            <button type="button" data-copy-token="${escapeHtml(i.token)}" aria-label="Copy token"><svg><use href="#i-copy"/></svg></button>
          </span></td>
          <td><b style="font-weight:500">${escapeHtml(i.inviter)}</b><br><span class="tiny muted">${escapeHtml(i.inviter_registration_id)}</span></td>
          <td>${tagFor(i.status)}</td>
          <td>${i.accepted_by ? escapeHtml(i.accepted_by) : '<span class="muted">—</span>'}</td>
          <td class="muted" style="font-size:.76rem;white-space:nowrap">${formatDateTime(i.expires_at)}</td>
          <td><button class="btn btn--sm btn--ghost" type="button" data-copy-invite-link="${escapeHtml(i.invite_url)}">Copy link</button></td>
        </tr>`).join('');

      $$('[data-copy-token]', body).forEach(b => b.addEventListener('click', () => copy(b.dataset.copyToken, 'Token copied')));
      $$('[data-copy-invite-link]', body).forEach(b => b.addEventListener('click', () => copy(b.dataset.copyInviteLink, 'Invitation link copied')));
    } catch (err) {
      if (err.status === 401) { showLogin(); return; }
      body.innerHTML = `<tr><td colspan="6" class="muted" style="padding:1.4rem">${escapeHtml(err.message || 'Could not load invitations.')}</td></tr>`;
    }
  }

  /* ============================================================
     AUDIT
     ============================================================ */
  async function loadAudit() {
    const host = $('[data-audit-list]');
    if (!host) return;
    host.innerHTML = '<div class="muted tiny" style="padding:1rem">Loading activity…</div>';
    try {
      const rows = await API.audit();
      if (!rows.length) { host.innerHTML = '<div class="muted tiny" style="padding:1rem">No activity recorded yet.</div>'; return; }
      host.innerHTML = rows.map(a => {
        const glyph = a.action.includes('login') ? 'IN'
          : a.action.includes('delete') ? 'DEL'
          : a.action.includes('invite') ? 'INV'
          : a.action.includes('check') ? 'CHK'
          : 'REG';
        return `<div class="audit-row">
          <i>${glyph}</i>
          <div><b>${escapeHtml(a.action)}</b> · <span style="margin:0;font-size:.8rem;color:var(--white-60)">${escapeHtml(a.target || '')}</span></div>
          <span>${escapeHtml(a.by || '')} · ${timeAgo(a.at)}</span>
        </div>`;
      }).join('');
    } catch (err) {
      host.innerHTML = `<div class="muted tiny" style="padding:1rem">${escapeHtml(err.message || 'Could not load activity.')}</div>`;
    }
  }

  /* ============================================================
     BOOT
     ============================================================ */
  boot();
})();
