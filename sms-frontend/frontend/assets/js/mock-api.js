/* ============================================================
   SMS SUMMIT 2026 — Mock API
   A faithful, in-browser stand-in for the FastAPI backend.
   Mirrors the contract documented in API-CONTRACT.md so the
   UI can be built, demoed and QA'd before the backend exists.
   Persists to localStorage. Delete nothing — set
   SMS_CONFIG.USE_MOCK_API = false to switch to the real API.
   ============================================================ */
(function () {
  'use strict';

  const LS_KEY = 'sms_mock_db_v1';
  const SESSION_KEY = 'sms_mock_session_v1';
  const TICKET_STATUS = ['registered', 'checked_in', 'cancelled'];

  const nowISO = () => new Date().toISOString();
  const addMinutes = (mins) => new Date(Date.now() + mins * 60000).toISOString();

  /* ---------- demo seed ---------- */
  const SEED = [
    ['Chinedu Okafor', 'chinedu.okafor@example.com', '+2348031234567', 'male', 'married', 'Tech / Engineering'],
    ['Adaeze Okafor', 'adaeze.okafor@example.com', '+2348031234568', 'female', 'married', 'Business / Finance'],
    ['Michael Eze', 'michael.eze@example.com', '+2348052223344', 'male', 'single', 'Media & Arts'],
    ['Grace Aluko', 'grace.aluko@example.com', '+2348075551122', 'female', 'single', 'Health / Medicine'],
    ['Tunde Balogun', 'tunde.balogun@example.com', '+2348096667788', 'male', 'engaged', 'Legal / Policy'],
    ['Blessing Johnson', 'blessing.j@example.com', '+2348024445566', 'female', 'married', 'Education / Ministry'],
    ['Emeka Nwosu', 'emeka.nwosu@example.com', '+2348112224455', 'male', 'single', 'Business / Finance'],
    ['Zainab Bello', 'zainab.bello@example.com', '+2348063334455', 'female', 'single', 'Tech / Engineering'],
    ['Jide Oladipo', 'jide.oladipo@example.com', '+2348037778899', 'male', 'engaged', 'Real Estate'],
    ['Esther David', 'esther.david@example.com', '+2348129990011', 'female', 'married', 'Media & Arts'],
    ['Samuel Okon', 'samuel.okon@example.com', '+2348156667788', 'male', 'single', 'Student'],
    ['Precious Amadi', 'precious.amadi@example.com', '+2348012223344', 'female', 'single', 'Health / Medicine']
  ];

  function uid(prefix, len) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    const bytes = new Uint32Array(len);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < len; i++) s += alphabet[bytes[i] % alphabet.length];
    return prefix + s;
  }

  function initialDB() {
    const db = { registrations: [], spouses: [], invites: [], organizers: [], audit: [], counters: { reg: 0 } };
    SEED.forEach((row, i) => {
      const [full_name, email, phone, gender, marital_status, occupation] = row;
      const created = new Date(Date.now() - (SEED.length - i) * 7.4 * 3600 * 1000).toISOString();
      db.registrations.push({
        id: 'reg_' + (i + 1),
        registration_id: uid('SMS26-', 4) + '-' + String(1000 + i),
        full_name, email, phone, gender, marital_status, occupation,
        age_range: ['26-32', '33-39', '40-49', '18-25'][i % 4],
        city: 'Port Harcourt',
        expectations: null,
        emergency_contact_name: null,
        emergency_contact_phone: null,
        spouse_id: null,
        status: i < 3 ? 'checked_in' : 'registered',
        qr_payload: null,
        created_at: created,
        updated_at: created
      });
    });
    db.registrations.forEach(r => { r.qr_payload = 'SMS26|' + r.registration_id; });

    // Link Okafor couple with an accepted invite
    const chinedu = db.registrations[0];
    const adaeze = db.registrations[1];
    chinedu.spouse_id = adaeze.id;
    adaeze.spouse_id = chinedu.id;
    db.spouses.push({ id: 'sp_1', registration_id: chinedu.id, spouse_registration_id: adaeze.id, linked_at: nowISO(), invited_via: 'invite_1' });
    db.invites.push({
      id: 'invite_1',
      token: 'INV8F3K2L9QX',
      inviter_id: chinedu.id,
      status: 'accepted',
      expires_at: addMinutes(60 * 24 * 2),
      accepted_by: adaeze.id,
      accepted_at: nowISO(),
      created_at: nowISO()
    });
    // One live pending invite to demo the flow
    db.invites.push({
      id: 'invite_2',
      token: 'INV5D7M4T1WZ',
      inviter_id: db.registrations[5].id,
      status: 'pending',
      expires_at: addMinutes(60 * 26),
      accepted_by: null,
      accepted_at: null,
      created_at: nowISO()
    });
    db.organizers.push({
      id: 'org_1',
      name: 'Precious A.',
      email: 'admin@smssummit.org',
      password_hash: hash('Summit2026!'),
      role: 'admin',
      active: true
    });
    db.organizers.push({
      id: 'org_2',
      name: 'Desk Team',
      email: 'desk@smssummit.org',
      password_hash: hash('Desk2026!'),
      role: 'organizer',
      active: true
    });
    return db;
  }

  /* Tiny non-cryptographic digest — mock only, never ship real auth this way. */
  function hash(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + '.' + (h1 >>> 0).toString(16);
  }

  function loadDB() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const db = JSON.parse(raw);
        if (db && Array.isArray(db.registrations)) return db;
      }
    } catch (e) { /* corrupted store — reseed */ }
    const db = initialDB();
    saveDB(db);
    return db;
  }
  function saveDB(db) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(db)); } catch (e) {}
  }

  function resetDB() {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(SESSION_KEY);
    return loadDB();
  }

  /* ---------- error helper ---------- */
  function HttpError(status, code, message, fields) {
    const e = new Error(message);
    e.status = status;
    e.code = code;
    e.fields = fields || null;
    return e;
  }

  /* ---------- validation (mirrors Pydantic schema) ---------- */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  const PHONE_RE = /^\+?[0-9\s\-()]{7,20}$/;
  const GENDERS = ['male', 'female'];
  const MARITAL = ['single', 'engaged', 'married'];

  function validateRegistration(p, db, opts) {
    opts = opts || {};
    const f = {};
    const name = (p.full_name || '').trim();
    if (name.length < 3) f.full_name = 'Enter your full name (at least 3 characters).';
    else if (!/^[A-Za-z\u00C0-\u024F' .-]+$/.test(name)) f.full_name = 'Letters, spaces, hyphens and apostrophes only.';

    const email = (p.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) f.email = 'Enter a valid email address.';
    else if (db.registrations.some(r => r.email === email && r.id !== opts.excludeId))
      f.email = 'This email is already registered. Try the lookup page.';

    const phone = (p.phone || '').replace(/\s+/g, ' ');
    if (!PHONE_RE.test(phone) || phone.replace(/\D/g, '').length < 10) f.phone = 'Enter a valid phone number, e.g. +234 803 123 4567.';

    if (!GENDERS.includes(p.gender)) f.gender = 'Select Male or Female.';
    if (!MARITAL.includes(p.marital_status)) f.marital_status = 'Select your marital status.';
    if (!p.occupation) f.occupation = 'Select your field.';
    if (!p.age_range) f.age_range = 'Select your age range.';
    if (p.emergency_contact_phone && !PHONE_RE.test(p.emergency_contact_phone))
      f.emergency_contact_phone = 'Enter a valid phone number.';

    return { fields: f, clean: {
      full_name: name.replace(/\s+/g, ' '),
      email, phone,
      gender: p.gender,
      marital_status: p.marital_status,
      occupation: p.occupation,
      age_range: p.age_range,
      city: (p.city || '').trim() || null,
      expectations: (p.expectations || '').trim() || null,
      emergency_contact_name: (p.emergency_contact_name || '').trim() || null,
      emergency_contact_phone: (p.emergency_contact_phone || '').trim() || null
    }};
  }

  function nextRegistrationId(db) {
    db.counters.reg = (db.counters.reg || 0) + 1;
    const seq = String(db.counters.reg).padStart(4, '0');
    return uid('SMS26-', 4) + '-' + seq;
  }

  function findByRegId(db, registration_id) {
    const needle = String(registration_id || '').trim().toUpperCase();
    return db.registrations.find(r => r.registration_id.toUpperCase() === needle) ||
           db.registrations.find(r => r.id === registration_id);
  }

  function publicView(db, r) {
    const spouse = r.spouse_id ? db.registrations.find(x => x.id === r.spouse_id) : null;
    const pending = db.invites.find(i => i.inviter_id === r.id && i.status === 'pending');
    return {
      id: r.id,
      registration_id: r.registration_id,
      full_name: r.full_name,
      email: r.email,
      phone: r.phone,
      gender: r.gender,
      marital_status: r.marital_status,
      occupation: r.occupation,
      age_range: r.age_range,
      city: r.city,
      status: r.status,
      qr_payload: r.qr_payload,
      created_at: r.created_at,
      spouse: spouse ? { id: spouse.id, registration_id: spouse.registration_id, full_name: spouse.full_name } : null,
      pending_invite: pending ? {
        token: pending.token,
        expires_at: pending.expires_at,
        invite_url: inviteUrl(pending.token)
      } : null
    };
  }

  function inviteUrl(token) {
    const base = location.origin + location.pathname.replace(/[^/]*$/, '');
    return base + 'invite.html?token=' + encodeURIComponent(token);
  }

  function adminView(db, r) {
    const v = publicView(db, r);
    return Object.assign(v, {
      expectations: r.expectations,
      emergency_contact_name: r.emergency_contact_name,
      emergency_contact_phone: r.emergency_contact_phone,
      updated_at: r.updated_at,
      invite_accepted: !!r.spouse_id
    });
  }

  /* ---------- auth ---------- */
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { return null; }
  }
  function setSession(s) {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  }
  function requireOrganizer(roles) {
    const s = getSession();
    if (!s || !s.token) throw HttpError(401, 'not_authenticated', 'Sign in to continue.');
    if (Date.parse(s.expires_at || 0) < Date.now()) {
      setSession(null);
      throw HttpError(401, 'session_expired', 'Your session expired. Sign in again.');
    }
    if (roles && roles.length && !roles.includes(s.role)) throw HttpError(403, 'forbidden', 'You do not have permission for this action.');
    return s;
  }
  function makeToken() { return 'mock.' + btoa(JSON.stringify({ t: Date.now(), n: Math.random() })).replace(/=/g, ''); }

  /* ---------- latency simulation ---------- */
  const delay = (ms) => new Promise(res => setTimeout(res, ms));
  const jitter = (min, max) => min + Math.random() * (max - min);

  /* ============================================================
     Public mock surface — shaped exactly like the REST endpoints
     ============================================================ */
  const MockAPI = {
    reset: resetDB,

    async createRegistration(payload) {
      await delay(jitter(500, 900));
      const db = loadDB();
      const { fields, clean } = validateRegistration(payload, db);
      if (Object.keys(fields).length) throw HttpError(422, 'validation_error', 'Please correct the highlighted fields.', fields);

      const reg = Object.assign({
        id: 'reg_' + Math.random().toString(36).slice(2, 9),
        registration_id: nextRegistrationId(db),
        spouse_id: null,
        status: 'registered',
        created_at: nowISO(),
        updated_at: nowISO()
      }, clean);
      reg.qr_payload = 'SMS26|' + reg.registration_id;
      db.registrations.push(reg);

      let invite = null;
      if (payload.wants_spouse_invite && reg.marital_status === 'married') {
        invite = {
          id: 'invite_' + Math.random().toString(36).slice(2, 9),
          token: 'INV' + uid('', 9),
          inviter_id: reg.id,
          status: 'pending',
          expires_at: addMinutes(60 * 48),
          accepted_by: null,
          accepted_at: null,
          created_at: nowISO()
        };
        db.invites.unshift(invite);
      }
      db.audit.unshift({ at: nowISO(), action: 'registration.created', target: reg.registration_id, by: 'public' });
      saveDB(db);

      return {
        registration: publicView(db, reg),
        spouse_invite: invite ? {
          token: invite.token,
          status: invite.status,
          expires_at: invite.expires_at,
          invite_url: inviteUrl(invite.token)
        } : null,
        message: 'Registration successful.'
      };
    },

    async getRegistration(registration_id) {
      await delay(jitter(350, 650));
      const db = loadDB();
      const reg = findByRegId(db, registration_id);
      if (!reg) throw HttpError(404, 'not_found', 'No registration matches that ID.');
      return publicView(db, reg);
    },

    async checkin(registration_id) {
      await delay(jitter(300, 550));
      const db = loadDB();
      const reg = findByRegId(db, registration_id);
      if (!reg) throw HttpError(404, 'not_found', 'No registration matches that ID.');
      if (reg.status === 'cancelled') throw HttpError(409, 'cancelled', 'This registration was cancelled.');
      reg.status = 'checked_in';
      reg.updated_at = nowISO();
      db.audit.unshift({ at: nowISO(), action: 'registration.checked_in', target: reg.registration_id, by: 'public' });
      saveDB(db);
      return publicView(db, reg);
    },

    async createInvite(payload) {
      await delay(jitter(400, 700));
      const db = loadDB();
      const inviter = db.registrations.find(r => r.id === payload.registration_id || r.registration_id === payload.registration_id);
      if (!inviter) throw HttpError(404, 'not_found', 'Registration not found.');
      if (inviter.spouse_id) throw HttpError(409, 'already_linked', 'This registration is already linked to a spouse.');
      const existing = db.invites.find(i => i.inviter_id === inviter.id && i.status === 'pending');
      if (existing) {
        return { token: existing.token, status: 'pending', expires_at: existing.expires_at, invite_url: inviteUrl(existing.token) };
      }
      const invite = {
        id: 'invite_' + Math.random().toString(36).slice(2, 9),
        token: 'INV' + uid('', 9),
        inviter_id: inviter.id,
        status: 'pending',
        expires_at: addMinutes(60 * 48),
        accepted_by: null,
        accepted_at: null,
        created_at: nowISO()
      };
      db.invites.unshift(invite);
      db.audit.unshift({ at: nowISO(), action: 'invite.created', target: invite.token, by: 'public' });
      saveDB(db);
      return { token: invite.token, status: 'pending', expires_at: invite.expires_at, invite_url: inviteUrl(invite.token) };
    },

    async getInvite(token) {
      await delay(jitter(250, 500));
      const db = loadDB();
      const invite = db.invites.find(i => i.token === token);
      if (!invite) throw HttpError(404, 'not_found', 'This invitation link is not valid.');
      const inviter = db.registrations.find(r => r.id === invite.inviter_id);
      const expired = Date.parse(invite.expires_at) < Date.now();
      return {
        token: invite.token,
        status: expired && invite.status === 'pending' ? 'expired' : invite.status,
        expires_at: invite.expires_at,
        inviter: {
          full_name: inviter.full_name,
          gender: inviter.gender,
          marital_status: inviter.marital_status,
          registration_id: inviter.registration_id
        },
        accepted_by: invite.accepted_by ? (db.registrations.find(r => r.id === invite.accepted_by) || {}).full_name : null,
        can_accept: invite.status === 'pending' && !expired
      };
    },

    async acceptInvite(token, payload) {
      await delay(jitter(650, 1000));
      const db = loadDB();
      const invite = db.invites.find(i => i.token === token);
      if (!invite) throw HttpError(404, 'not_found', 'This invitation link is not valid.');
      if (invite.status === 'accepted') throw HttpError(409, 'already_accepted', 'This invitation has already been accepted.');
      if (Date.parse(invite.expires_at) < Date.now()) {
        invite.status = 'expired';
        saveDB(db);
        throw HttpError(410, 'invite_expired', 'This invitation has expired. Ask your spouse to send a new one.');
      }
      const inviter = db.registrations.find(r => r.id === invite.inviter_id);

      let reg;
      if (payload.mode === 'existing') {
        reg = findByRegId(db, payload.registration_id);
        if (!reg) throw HttpError(404, 'not_found', 'We could not find that registration ID.');
        if (reg.id === inviter.id) throw HttpError(409, 'self_link', 'You cannot link a registration to itself.');
        if (reg.spouse_id) throw HttpError(409, 'already_linked', 'That registration is already linked to a spouse.');
        if (reg.gender === inviter.gender)
          throw HttpError(409, 'gender_mismatch', 'Spouse links must be between a male and a female registration.');
      } else {
        const body = payload.registration || payload;
        const { fields, clean } = validateRegistration(body, db);
        if (Object.keys(fields).length) throw HttpError(422, 'validation_error', 'Please correct the highlighted fields.', fields);
        if (body.gender === inviter.gender) throw HttpError(409, 'gender_mismatch', 'Spouse links must be between a male and a female registration.');
        reg = Object.assign({
          id: 'reg_' + Math.random().toString(36).slice(2, 9),
          registration_id: nextRegistrationId(db),
          spouse_id: null,
          status: 'registered',
          created_at: nowISO(),
          updated_at: nowISO()
        }, clean);
        reg.qr_payload = 'SMS26|' + reg.registration_id;
        db.registrations.push(reg);
      }

      inviter.spouse_id = reg.id;
      reg.spouse_id = inviter.id;
      reg.updated_at = nowISO();
      invite.status = 'accepted';
      invite.accepted_by = reg.id;
      invite.accepted_at = nowISO();
      db.spouses.push({ id: 'sp_' + Math.random().toString(36).slice(2, 8), registration_id: inviter.id, spouse_registration_id: reg.id, linked_at: nowISO(), invited_via: invite.id });
      db.audit.unshift({ at: nowISO(), action: 'invite.accepted', target: invite.token, by: 'public' });
      saveDB(db);

      return { message: 'Spouse linked successfully.', registration: publicView(db, reg), spouse: publicView(db, inviter) };
    },

    async revokeInvite(token) {
      await delay(jitter(300, 500));
      const db = loadDB();
      const invite = db.invites.find(i => i.token === token);
      if (!invite) throw HttpError(404, 'not_found', 'Invitation not found.');
      if (invite.status === 'accepted') throw HttpError(409, 'already_accepted', 'Accepted invitations cannot be revoked.');
      invite.status = 'revoked';
      saveDB(db);
      return { token, status: 'revoked' };
    },

    /* ----- organizer auth ----- */
    async login(payload) {
      await delay(jitter(600, 900));
      const db = loadDB();
      const email = (payload.email || '').trim().toLowerCase();
      const org = db.organizers.find(o => o.email === email);
      if (!org || org.password_hash !== hash(payload.password || '') || !org.active)
        throw HttpError(401, 'invalid_credentials', 'Email or password is incorrect.');
      const session = {
        token: makeToken(),
        role: org.role,
        name: org.name,
        email: org.email,
        expires_at: new Date(Date.now() + 8 * 3600 * 1000).toISOString()
      };
      setSession(session);
      db.audit.unshift({ at: nowISO(), action: 'auth.login', target: org.email, by: org.email });
      saveDB(db);
      return session;
    },

    async me() {
      await delay(jitter(120, 260));
      return requireOrganizer();
    },

    async logout() {
      await delay(150);
      setSession(null);
      return { ok: true };
    },

    /* ----- organizer management ----- */
    async listRegistrations(params) {
      await delay(jitter(350, 650));
      requireOrganizer();
      const db = loadDB();
      params = params || {};
      const q = (params.q || '').trim().toLowerCase();
      let rows = db.registrations.slice();
      if (params.gender) rows = rows.filter(r => r.gender === params.gender);
      if (params.marital_status) rows = rows.filter(r => r.marital_status === params.marital_status);
      if (params.status) rows = rows.filter(r => r.status === params.status);
      if (params.linked === 'yes') rows = rows.filter(r => !!r.spouse_id);
      if (params.linked === 'no') rows = rows.filter(r => !r.spouse_id);
      if (q) rows = rows.filter(r =>
        r.full_name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')) ||
        r.registration_id.toLowerCase().includes(q)
      );
      const sort = params.sort || 'created_at';
      const dir = params.dir === 'asc' ? 1 : -1;
      rows.sort((a, b) => {
        const av = a[sort] || '', bv = b[sort] || '';
        return av > bv ? dir : av < bv ? -dir : 0;
      });
      const page = Math.max(1, parseInt(params.page || 1, 10));
      const perPage = Math.min(100, Math.max(5, parseInt(params.per_page || 10, 10)));
      const total = rows.length;
      const slice = rows.slice((page - 1) * perPage, page * perPage);
      return {
        items: slice.map(r => adminView(db, r)),
        total, page, per_page: perPage, pages: Math.max(1, Math.ceil(total / perPage))
      };
    },

    async getRegistrationAdmin(id) {
      await delay(jitter(250, 480));
      requireOrganizer();
      const db = loadDB();
      const reg = findByRegId(db, id);
      if (!reg) throw HttpError(404, 'not_found', 'Registration not found.');
      return adminView(db, reg);
    },

    async updateStatus(id, status) {
      await delay(jitter(300, 520));
      const session = requireOrganizer(['admin', 'organizer']);
      const db = loadDB();
      const reg = findByRegId(db, id);
      if (!reg) throw HttpError(404, 'not_found', 'Registration not found.');
      if (!TICKET_STATUS.includes(status)) throw HttpError(422, 'validation_error', 'Unknown status.');
      reg.status = status;
      reg.updated_at = nowISO();
      db.audit.unshift({ at: nowISO(), action: 'registration.status', target: reg.registration_id + ' → ' + status, by: session.email });
      saveDB(db);
      return adminView(db, reg);
    },

    async deleteRegistration(id) {
      await delay(jitter(400, 700));
      const session = requireOrganizer(['admin']);
      const db = loadDB();
      const reg = findByRegId(db, id);
      if (!reg) throw HttpError(404, 'not_found', 'Registration not found.');
      // Detach the spouse relationship but keep the other attendee intact
      if (reg.spouse_id) {
        const spouse = db.registrations.find(r => r.id === reg.spouse_id);
        if (spouse) spouse.spouse_id = null;
      }
      db.registrations = db.registrations.filter(r => r.id !== reg.id);
      db.invites = db.invites.filter(i => i.inviter_id !== reg.id);
      db.audit.unshift({ at: nowISO(), action: 'registration.deleted', target: reg.registration_id, by: session.email });
      saveDB(db);
      return { ok: true };
    },

    async stats() {
      await delay(jitter(300, 550));
      requireOrganizer();
      const db = loadDB();
      const regs = db.registrations;
      const byDay = {};
      regs.forEach(r => {
        const d = new Date(r.created_at);
        const key = d.toISOString().slice(0, 10);
        byDay[key] = (byDay[key] || 0) + 1;
      });
      const days = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const key = d.toISOString().slice(0, 10);
        days.push({ date: key, label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), count: byDay[key] || 0 });
      }
      const linked = regs.filter(r => r.spouse_id).length;
      return {
        total: regs.length,
        checked_in: regs.filter(r => r.status === 'checked_in').length,
        cancelled: regs.filter(r => r.status === 'cancelled').length,
        male: regs.filter(r => r.gender === 'male').length,
        female: regs.filter(r => r.gender === 'female').length,
        married: regs.filter(r => r.marital_status === 'married').length,
        engaged: regs.filter(r => r.marital_status === 'engaged').length,
        single: regs.filter(r => r.marital_status === 'single').length,
        linked_pairs: Math.floor(linked / 2),
        pending_invites: db.invites.filter(i => i.status === 'pending').length,
        by_day: days,
        by_occupation: Object.entries(regs.reduce((acc, r) => { acc[r.occupation] = (acc[r.occupation] || 0) + 1; return acc; }, {})).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
      };
    },

    async exportCSV() {
      await delay(jitter(300, 500));
      requireOrganizer();
      const db = loadDB();
      return db.registrations.map(r => adminView(db, r));
    },

    async audit() {
      await delay(150);
      requireOrganizer();
      return loadDB().audit.slice(0, 25);
    },

    /* ----- helpers used by the UI ----- */
    async invites(params) {
      await delay(jitter(200, 400));
      requireOrganizer();
      const db = loadDB();
      return db.invites.map(i => {
        const inviter = db.registrations.find(r => r.id === i.inviter_id) || {};
        const accepted = i.accepted_by ? (db.registrations.find(r => r.id === i.accepted_by) || {}) : null;
        const expired = Date.parse(i.expires_at) < Date.now() && i.status === 'pending';
        return {
          token: i.token,
          status: expired ? 'expired' : i.status,
          expires_at: i.expires_at,
          created_at: i.created_at,
          inviter: inviter.full_name || '—',
          inviter_registration_id: inviter.registration_id || '—',
          accepted_by: accepted ? accepted.full_name : null,
          invite_url: inviteUrl(i.token)
        };
      });
    },

    /* ---- portable invitation (preview-mode only) ----
       Lets an invitation opened on another device/browser still resolve,
       exactly as a real shared token would against a live backend. */
    exportInvite(token) {
      const db = loadDB();
      const invite = db.invites.find(i => i.token === token);
      if (!invite) return null;
      const inviter = db.registrations.find(r => r.id === invite.inviter_id);
      const payload = {
        invite: Object.assign({}, invite),
        inviter: inviter ? Object.assign({}, inviter) : null,
        existing_emails: db.registrations.map(r => r.email),
        v: 1
      };
      try { return btoa(encodeURIComponent(JSON.stringify(payload))); } catch (e) { return null; }
    },

    importInvite(token) {
      const db = loadDB();
      if (db.invites.some(i => i.token === token)) return true;
      const raw = new URLSearchParams(location.search).get('p');
      if (!raw) return false;
      let payload;
      try { payload = JSON.parse(decodeURIComponent(atob(raw))); } catch (e) { return false; }
      if (!payload || !payload.invite || !payload.inviter) return false;
      if (payload.invite.token !== token) return false;
      if (!db.registrations.some(r => r.id === payload.inviter.id)) {
        db.registrations.push(payload.inviter);
      }
      db.invites.push(payload.invite);
      saveDB(db);
      return true;
    },

    async simulateAttendance(n) {
      await delay(200);
      const db = loadDB();
      const pool = db.registrations.filter(r => r.status === 'registered');
      pool.slice(0, n || 3).forEach(r => { r.status = 'checked_in'; r.updated_at = nowISO(); });
      saveDB(db);
      return { ok: true };
    }
  };

  /* seed on load so any page can resolve IDs immediately */
  try { loadDB(); } catch (e) {}

  window.SMSMock = MockAPI;
})();
