/* ============================================================
   SMS SUMMIT 2026 — Registration flow
   3-step wizard · inline validation · spouse invite hand-off
   ============================================================ */
(function () {
  'use strict';

  const { $, $$, toast } = window.SMSUI;
  const API = window.SMSApi;

  const form = $('[data-reg-form]');
  if (!form) return;

  const steps = $$('.form-step');
  const stepBars = $$('[data-stepbar]');
  const SKIP_VALIDATE = new Set(['wants_spouse_invite', 'consent', 'expectations', 'city',
    'emergency_contact_name', 'emergency_contact_phone']);

  let current = 1;

  /* ---------- field helpers ---------- */
  const fieldEl = (name) => form.querySelector(`[data-field="${name}"]`);
  const radios = (name) => Array.from(form.querySelectorAll(`input[name="${name}"]`));

  /* NOTE: form.elements[name] returns a RadioNodeList for grouped radios,
     so always resolve real inputs with querySelector. */
  const inputEl = (name) => form.querySelector(`[name="${name}"]`);

  function valueOf(name) {
    const rs = radios(name).filter(r => r.type === 'radio');
    if (rs.length) {
      const checked = rs.find(r => r.checked);
      return checked ? checked.value : '';
    }
    const el = inputEl(name);
    return el ? String(el.value).trim() : '';
  }

  function setError(name, message) {
    const f = fieldEl(name);
    if (!f) return;
    f.classList.toggle('has-error', !!message);
    const slot = f.querySelector('[data-error]');
    if (slot) slot.textContent = message || '';
    const input = f.querySelector('input, select, textarea');
    if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function clearError(name) {
    if (fieldEl(name)) setError(name, '');
  }

  /* ---------- validation ---------- */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  const PHONE_RE = /^\+?[0-9\s\-()]{7,20}$/;
  const NAME_RE = /^[A-Za-z\u00C0-\u024F' .-]{3,90}$/;

  const VALIDATORS = {
    1: () => {
      const errors = {};
      const name = valueOf('full_name');
      if (!name) errors.full_name = 'Please enter your full name.';
      else if (!NAME_RE.test(name)) errors.full_name = 'Use letters, spaces, hyphens or apostrophes (min 3 characters).';

      const email = valueOf('email');
      if (!email) errors.email = 'Please enter your email address.';
      else if (!EMAIL_RE.test(email)) errors.email = 'That email doesn\'t look right.';

      const phone = valueOf('phone');
      if (!phone) errors.phone = 'Please enter your phone number.';
      else if (!PHONE_RE.test(phone) || phone.replace(/\D/g, '').length < 10)
        errors.phone = 'Enter a valid phone number, e.g. +234 803 123 4567.';

      if (!valueOf('gender')) errors.gender = 'Please select Male or Female.';
      if (!valueOf('marital_status')) errors.marital_status = 'Please select your marital status.';
      return errors;
    },
    2: () => {
      const errors = {};
      if (!valueOf('occupation')) errors.occupation = 'Please select your field.';
      if (!valueOf('age_range')) errors.age_range = 'Please select your age range.';
      const ec = valueOf('emergency_contact_phone');
      if (ec && (!PHONE_RE.test(ec) || ec.replace(/\D/g, '').length < 10))
        errors.emergency_contact_phone = 'Enter a valid phone number.';
      return errors;
    },
    3: () => {
      const errors = {};
      if (!(inputEl('consent') || {}).checked) errors.consent = 'Please confirm your details to continue.';
      return errors;
    }
  };

  function validateStep(step) {
    const errors = VALIDATORS[step] ? VALIDATORS[step]() : {};
    // clear previous errors for fields in this step
    steps[step - 1].querySelectorAll('[data-field]').forEach(f => setError(f.dataset.field, ''));
    Object.entries(errors).forEach(([name, msg]) => setError(name, msg));
    if (errors.consent) {
      const slot = $('[data-consent-error]');
      if (slot) slot.textContent = errors.consent;
    } else {
      const slot = $('[data-consent-error]');
      if (slot) slot.textContent = '';
    }
    const first = Object.keys(errors)[0];
    if (first) {
      const f = fieldEl(first);
      const target = f ? f.querySelector('input, select') : $('[data-consent]');
      if (target) {
        target.focus({ preventScroll: false });
        if (timing.instantScroll) f && f.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      if (f) f.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }],
        { duration: 320, easing: 'ease-in-out' }
      );
    }
    return Object.keys(errors).length === 0;
  }
  const timing = { instantScroll: true };

  /* ---------- navigation ---------- */
  function goTo(step, opts) {
    opts = opts || {};
    if (step < 1 || step > steps.length) return;
    const prev = current;
    current = step;
    steps.forEach(s => s.classList.toggle('is-active', +s.dataset.step === step));
    stepBars.forEach(b => {
      const n = +b.dataset.stepbar;
      b.classList.toggle('is-done', n < step);
      b.classList.toggle('is-active', n === step);
    });
    if (opts.scroll !== false) {
      const card = $('.reg-card');
      if (card) {
        const y = card.getBoundingClientRect().top + window.scrollY - 110;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }
    if (step === 3) renderReview();
    const title = steps[step - 1].querySelector('.form-section-title');
    if (title) title.setAttribute('tabindex', '-1');
    if (step > prev && step === 2) syncSpousePanel();
  }

  form.addEventListener('click', (e) => {
    const next = e.target.closest('[data-next]');
    if (next) {
      if (validateStep(current)) goTo(current + 1);
      else toast('Please fix the highlighted fields.', { type: 'err', title: 'Almost there' });
      return;
    }
    const back = e.target.closest('[data-back]');
    if (back) { goTo(current - 1); return; }

    const edit = e.target.closest('[data-edit-step]');
    if (edit) { goTo(+edit.dataset.editStep); }
  });

  /* honour Enter to advance */
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && current < 3) {
      e.preventDefault();
      if (validateStep(current)) goTo(current + 1);
    }
  });

  /* ---------- live clearing + formatting ---------- */
  ['full_name', 'email', 'phone', 'city', 'emergency_contact_phone'].forEach(name => {
    const el = inputEl(name);
    if (!el) return;
    el.addEventListener('input', () => { if (fieldEl(name)) clearError(name); });
    el.addEventListener('blur', () => {
      if (!el.value.trim()) return;
      // gentle per-field check on blur
      if (name === 'email' && !EMAIL_RE.test(el.value.trim())) setError('email', 'That email doesn\'t look right.');
      if (name === 'phone' && (!PHONE_RE.test(el.value.trim()) || el.value.replace(/\D/g, '').length < 10))
        setError('phone', 'Enter a valid phone number.');
    });
  });

  radios('gender').filter(r => r.type === 'radio').forEach(r => r.addEventListener('change', () => clearError('gender')));
  radios('marital_status').filter(r => r.type === 'radio').forEach(r => r.addEventListener('change', () => {
    clearError('marital_status');
    syncSegmented();
    syncSpousePanel();
  }));
  ['occupation', 'age_range'].forEach(n => {
    const el = inputEl(n);
    if (el) el.addEventListener('change', () => clearError(n));
  });
  const consent = inputEl('consent');
  if (consent) consent.addEventListener('change', () => {
    const slot = $('[data-consent-error]');
    if (slot) slot.textContent = '';
  });

  /* ---------- segmented control ---------- */
  const seg = $('[data-segmented]');
  function syncSegmented() {
    if (!seg) return;
    seg.dataset.value = valueOf('marital_status');
  }

  /* ---------- spouse panel ---------- */
  const spousePanel = $('[data-spouse-panel]');
  function syncSpousePanel() {
    if (!spousePanel) return;
    const married = valueOf('marital_status') === 'married';
    spousePanel.classList.toggle('hidden', !married);
    if (married && spousePanel.animate && !window.SMSUI.REDUCED) {
      spousePanel.animate(
        [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
        { duration: 450, easing: 'cubic-bezier(.16,1,.3,1)' }
      );
    }
  }

  /* ---------- review ---------- */
  function renderReview() {
    const host = $('[data-review]');
    if (!host) return;
    const rows = [
      ['Full name', valueOf('full_name'), 1],
      ['Email', valueOf('email'), 1],
      ['Phone', valueOf('phone'), 1],
      ['Gender', window.SMSUI.titleCase(valueOf('gender')), 1],
      ['Marital status', window.SMSUI.titleCase(valueOf('marital_status')), 1],
      ['Field / occupation', valueOf('occupation'), 2],
      ['Age range', valueOf('age_range'), 2],
      ['City', valueOf('city') || '—', 2],
      ['What you hope to gain', valueOf('expectations') || '—', 2],
      ['Emergency contact', valueOf('emergency_contact_name')
        ? `${valueOf('emergency_contact_name')} · ${valueOf('emergency_contact_phone') || 'no phone'}`
        : '—', 2]
    ];
    if (valueOf('marital_status') === 'married') {
      rows.push(['Spouse invitation', (inputEl('wants_spouse_invite') || {}).checked
        ? 'Will be generated after registration' : 'Not now', 2]);
    }
    host.innerHTML = rows.map(([label, value, step]) => `
      <div class="review__row">
        <span>${window.SMSUI.escapeHtml(label)}</span>
        <b>${window.SMSUI.escapeHtml(value || '—')}</b>
        <button type="button" data-edit-step="${step}" aria-label="Edit ${window.SMSUI.escapeHtml(label)}" style="flex:0 0 auto;color:var(--champagne);font-size:.7rem;text-decoration:underline">Edit</button>
      </div>`).join('');
  }

  /* ---------- submit ---------- */
  let submitting = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!validateStep(1)) { goTo(1); return; }
    if (!validateStep(2)) { goTo(2); return; }
    if (!validateStep(3)) { toast('Please confirm your details first.', { type: 'err' }); return; }

    const payload = {
      full_name: valueOf('full_name').replace(/\s+/g, ' '),
      email: valueOf('email').toLowerCase(),
      phone: valueOf('phone'),
      gender: valueOf('gender'),
      marital_status: valueOf('marital_status'),
      occupation: valueOf('occupation'),
      age_range: valueOf('age_range'),
      city: valueOf('city'),
      expectations: valueOf('expectations'),
      emergency_contact_name: valueOf('emergency_contact_name'),
      emergency_contact_phone: valueOf('emergency_contact_phone'),
      wants_spouse_invite: !!((inputEl('wants_spouse_invite') || {}).checked)
    };

    setSubmitting(true);
    try {
      const result = await API.register(payload);
      try {
        sessionStorage.setItem('sms_last_registration', JSON.stringify(result));
      } catch (err) {}
      // hand off to the ticket page
      const id = result.registration.registration_id;
      window.location.href = 'success.html?id=' + encodeURIComponent(id) + '&new=1';
    } catch (err) {
      setSubmitting(false);
      if (err.fields) {
        Object.entries(err.fields).forEach(([name, msg]) => setError(name, msg));
        const firstKey = Object.keys(err.fields)[0];
        const stepOfField = steps.findIndex(s => s.querySelector(`[data-field="${firstKey}"]`));
        if (stepOfField >= 0) goTo(stepOfField + 1);
        toast(err.message || 'Please correct the highlighted fields.', { type: 'err', title: 'Check your details' });
      } else if (err.status === 0) {
        toast('Network error — check your connection and try again.', { type: 'err' });
      } else {
        toast(err.message || 'Registration failed. Please try again.', { type: 'err' });
      }
    }
  });

  function setSubmitting(on) {
    submitting = on;
    const btn = $('[data-submit]');
    if (!btn) return;
    btn.setAttribute('aria-disabled', String(on));
    btn.disabled = on;
    const label = $('[data-submit-label]');
    if (on) {
      if (label) label.textContent = 'Reserving your seat…';
      btn.querySelector('svg').outerHTML = '<span class="spin"></span>';
    }
  }

  /* ---------- draft autosave (so a refresh doesn't lose the form) ---------- */
  const DRAFT_KEY = 'sms_reg_draft_v1';
  function saveDraft() {
    const data = {};
    ['full_name', 'email', 'phone', 'occupation', 'age_range', 'city', 'expectations',
      'emergency_contact_name', 'emergency_contact_phone'].forEach(n => { data[n] = valueOf(n); });
    data.gender = valueOf('gender');
    data.marital_status = valueOf('marital_status');
    data.wants_spouse_invite = !!((inputEl('wants_spouse_invite') || {}).checked);
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch (e) {}
  }
  function restoreDraft() {
    let data;
    try { data = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) {}
    if (!data) return;
    Object.entries(data).forEach(([k, v]) => {
      if (k === 'gender' || k === 'marital_status') {
        radios(k).forEach(r => { if (r.value === v) r.checked = true; });
      } else if (k === 'wants_spouse_invite') {
        const wsi = inputEl('wants_spouse_invite'); if (wsi) wsi.checked = !!v;
      } else if (inputEl(k) && v) {
        inputEl(k).value = v;
      }
    });
    syncSegmented();
    syncSpousePanel();
  }

  form.addEventListener('input', saveDraft);
  form.addEventListener('change', saveDraft);

  /* ---------- init ---------- */
  restoreDraft();
  syncSegmented();
  syncSpousePanel();
  window.addEventListener('resize', () => {});

  /* decorative: preload the "welcome" transition on the success page */
  if (window.SMSApi && window.SMSApi.isMock()) {
    const badge = $('.reg-card__head .chip--live');
    if (badge) badge.insertAdjacentHTML('afterend', '<span class="chip chip--demo">Preview mode — data saved in this browser</span>');
  }
})();
