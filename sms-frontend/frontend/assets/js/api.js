/* ============================================================
   SMS SUMMIT 2026 — API client
   Single switch-point between the in-browser mock and the real
   FastAPI backend. Every call returns a Promise and throws an
   ApiError { status, code, message, fields } on failure —
   the exact shape the UI already knows how to display.
   ============================================================ */
(function () {
  'use strict';

  const CFG = window.SMS_CONFIG;
  const TOKEN_KEY = 'sms_token_v1';
  const SESSION_KEY = 'sms_organizer_v1';

  class ApiError extends Error {
    constructor(status, code, message, fields) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
      this.fields = fields || null;
    }
  }

  /* ---------- session ---------- */
  const Session = {
    get token() { return localStorage.getItem(TOKEN_KEY); },
    get() {
      try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || 'null'); }
      catch (e) { return null; }
    },
    set(session, remember) {
      localStorage.setItem(TOKEN_KEY, session.token);
      const store = remember === false ? sessionStorage : localStorage;
      store.setItem(SESSION_KEY, JSON.stringify(session));
    },
    clear() {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    }
  };

  /* ---------- low level fetch ---------- */
  async function request(method, path, body, opts) {
    opts = opts || {};
    const base = (CFG.API_BASE_URL || '').replace(/\/$/, '');
    const url = base + CFG.API_PREFIX + path;
    const headers = { 'Accept': 'application/json' };
    if (body !== undefined && body !== null) headers['Content-Type'] = 'application/json';
    if (opts.auth) {
      const token = Session.token;
      if (!token) throw new ApiError(401, 'not_authenticated', 'Please sign in.');
      headers['Authorization'] = 'Bearer ' + token;
    }

    let res;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body === undefined || body === null ? undefined : JSON.stringify(body)
      });
    } catch (e) {
      throw new ApiError(0, 'network_error', 'Network error. Check your connection and try again.');
    }

    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }

    if (!res.ok) {
      // FastAPI default error shapes: {detail: "..."} or {detail:[{loc,msg,type}]}
      let message = 'Something went wrong. Please try again.';
      let fields = null;
      let code = 'http_error';
      if (data && typeof data === 'object') {
        if (Array.isArray(data.detail)) {
          code = 'validation_error';
          message = 'Please correct the highlighted fields.';
          fields = {};
          data.detail.forEach(err => {
            const key = Array.isArray(err.loc) ? err.loc[err.loc.length - 1] : 'form';
            fields[key] = err.msg;
          });
        } else if (typeof data.detail === 'string') {
          message = data.detail;
        } else if (data.detail && typeof data.detail === 'object') {
          message = data.detail.message || message;
          code = data.detail.code || code;
          fields = data.detail.fields || null;
        } else if (data.message) {
          message = data.message;
          code = data.code || code;
          fields = data.fields || null;
        }
      }
      if (res.status === 401) { Session.clear(); }
      throw new ApiError(res.status, code, message, fields);
    }
    return data;
  }

  /* ---------- mock adapter ---------- */
  function mockCall(fn, ...args) {
    return Promise.resolve().then(() => fn.apply(window.SMSMock, args));
  }

  const useMock = () => !!CFG.USE_MOCK_API && !!window.SMSMock;

  const qs = (params) => {
    const p = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') p.append(k, v);
    });
    const s = p.toString();
    return s ? '?' + s : '';
  };

  /* ============================================================
     Public API surface used across the app
     ============================================================ */
  const API = {
    ApiError,
    Session,
    isMock: useMock,

    /* --- attendee --- */
    register(payload) {
      if (useMock()) return mockCall(window.SMSMock.createRegistration, payload);
      return request('POST', '/registrations', payload);
    },
    getRegistration(registrationId) {
      if (useMock()) return mockCall(window.SMSMock.getRegistration, registrationId);
      return request('GET', '/registrations/' + encodeURIComponent(registrationId));
    },
    checkIn(registrationId) {
      if (useMock()) return mockCall(window.SMSMock.checkin, registrationId);
      return request('POST', '/registrations/' + encodeURIComponent(registrationId) + '/checkin');
    },

    /* --- spouse linking --- */
    createInvite(registrationId) {
      if (useMock()) return mockCall(window.SMSMock.createInvite, { registration_id: registrationId });
      return request('POST', '/spouse-invitations', { registration_id: registrationId });
    },
    getInvite(token) {
      if (useMock()) return mockCall(window.SMSMock.getInvite, token);
      return request('GET', '/spouse-invitations/' + encodeURIComponent(token));
    },
    acceptInvite(token, payload) {
      if (useMock()) return mockCall(window.SMSMock.acceptInvite, token, payload);
      return request('POST', '/spouse-invitations/' + encodeURIComponent(token) + '/accept', payload);
    },
    revokeInvite(token) {
      if (useMock()) return mockCall(window.SMSMock.revokeInvite, token);
      return request('DELETE', '/spouse-invitations/' + encodeURIComponent(token));
    },

    /* --- organizer auth --- */
    async login(email, password, remember) {
      let session;
      if (useMock()) session = await mockCall(window.SMSMock.login, { email, password });
      else session = await request('POST', '/auth/login', { email, password });
      Session.set(session, remember);
      return session;
    },
    async me() {
      if (useMock()) return mockCall(window.SMSMock.me);
      const me = await request('GET', '/auth/me', null, { auth: true });
      return Object.assign(Session.get() || {}, me);
    },
    async logout() {
      try {
        if (useMock()) await mockCall(window.SMSMock.logout);
        else await request('POST', '/auth/logout', null, { auth: true });
      } finally {
        Session.clear();
      }
    },

    /* --- organizer management --- */
    listRegistrations(params) {
      if (useMock()) return mockCall(window.SMSMock.listRegistrations, params);
      return request('GET', '/admin/registrations' + qs(params), null, { auth: true });
    },
    getRegistrationAdmin(id) {
      if (useMock()) return mockCall(window.SMSMock.getRegistrationAdmin, id);
      return request('GET', '/admin/registrations/' + encodeURIComponent(id), null, { auth: true });
    },
    verifyQR(qrPayload) {
  if (useMock()) return mockCall(window.SMSMock.verifyQR, qrPayload);
  return request('POST', '/admin/qr/verify', {
    qr_payload: qrPayload
  }, { auth: true });
},
    updateStatus(id, status) {
      if (useMock()) return mockCall(window.SMSMock.updateStatus, id, status);
      return request('PATCH', '/admin/registrations/' + encodeURIComponent(id), { status }, { auth: true });
    },
    deleteRegistration(id) {
      if (useMock()) return mockCall(window.SMSMock.deleteRegistration, id);
      return request('DELETE', '/admin/registrations/' + encodeURIComponent(id), null, { auth: true });
    },
    stats() {
      if (useMock()) return mockCall(window.SMSMock.stats);
      return request('GET', '/admin/stats', null, { auth: true });
    },
    invites() {
      if (useMock()) return mockCall(window.SMSMock.invites);
      return request('GET', '/admin/spouse-invitations', null, { auth: true });
    },
    audit() {
      if (useMock()) return mockCall(window.SMSMock.audit);
      return request('GET', '/admin/audit-log', null, { auth: true });
    },
    async exportCSV() {
      if (useMock()) return mockCall(window.SMSMock.exportCSV);
      const res = await fetch((CFG.API_BASE_URL || '') + CFG.API_PREFIX + '/admin/registrations/export', {
        headers: { 'Authorization': 'Bearer ' + Session.token }
      });
      if (!res.ok) throw new ApiError(res.status, 'export_failed', 'Could not export registrations.');
      const csv = await res.text();
      downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'sms26-registrations.csv');
      return true;
    },

    /* --- spouse invitation preview (public, token-scoped) ---
       Backs "open my invitation somewhere else" in preview mode.
       Real backend: GET /api/v1/spouse-invitations/{token}/preview    */
    shareInvite(token) {
      if (!window.SMSMock) return null;
      return window.SMSMock.exportInvite(token);
    },
    previewInvite(token) {
      if (!window.SMSMock) return null;
      return window.SMSMock.importInvite(token);
    },

    /* --- demo helpers (mock only) --- */
    resetDemo() { if (window.SMSMock) window.SMSMock.reset(); },
    simulateAttendance(n) { if (window.SMSMock) return mockCall(window.SMSMock.simulateAttendance, n); }
  };

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  window.SMSApi = API;
  window.downloadBlob = downloadBlob;
})();
