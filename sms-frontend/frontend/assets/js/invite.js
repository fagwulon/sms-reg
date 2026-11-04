/* ============================================================
   SMS SUMMIT 2026 — Spouse invitation acceptance
   Explicit consent flow: existing registration or new one.
   ============================================================ */
(function () {
  'use strict';

  const UI = window.SMSUI;
  const API = window.SMSApi;
  const { $, $$, toast, formatDateTime, titleCase } = UI;

  const token = (new URLSearchParams(location.search).get('token') || '').trim();
  const loadingEl = $('[data-loading]');
  const invalidEl = $('[data-invalid]');
  const acceptEl = $('[data-accept]');
  const doneEl = $('[data-done]');

  let invite = null;

  const show = (el) => el && el.classList.remove('hidden');
  const hide = (el) => el && el.classList.add('hidden');

  function invalidate(message) {
    hide(loadingEl); hide(acceptEl); hide(doneEl);
    show(invalidEl);
    if (message) {
      const m = $('[data-invalid-msg]');
      if (m) m.textContent = message;
    }
  }

  /* ---------- boot ---------- */
  async function boot() {
    if (!token) {
      invalidate('This page needs an invitation token. Open the link your spouse sent you.');
      return;
    }
    try {
      try { API.previewInvite(token); } catch (e) { /* preview mode only */ }
      invite = await API.getInvite(token);
      if (invite.status === 'expired') {
        invalidate('This invitation has expired. Ask your spouse to create a fresh link from their ticket page.');
        return;
      }
      if (invite.status === 'revoked') {
        invalidate('This invitation was revoked by the person who sent it.');
        return;
      }
      if (invite.status === 'accepted') {
        invalidate(`This invitation has already been accepted${invite.accepted_by ? ' by ' + invite.accepted_by : ''}.`);
        return;
      }
      paint();
    } catch (err) {
      invalidate(err.message || 'We could not verify this invitation.');
    }
  }

  function paint() {
    hide(loadingEl); hide(invalidEl); hide(doneEl);
    show(acceptEl);
    $('[data-inviter-name]').textContent = invite.inviter.full_name;
    $('[data-meta-name]').textContent = invite.inviter.full_name;
    $('[data-meta-id]').textContent = invite.inviter.registration_id;
    $('[data-meta-expiry]').textContent = formatDateTime(invite.expires_at);
    // prefill gender with the opposite of the inviter — links are always male↔female
    const opposite = invite.inviter.gender === 'male' ? 'female' : 'male';
    $$('input[name="gender"]', $('[data-new-form]')).forEach(r => { r.checked = r.value === opposite; });
    syncMode();
  }

  /* ---------- mode switch ---------- */
  const seg = $('[data-mode-seg]');
  function syncMode() {
    const mode = (seg.querySelector('input:checked') || {}).value || 'new';
    seg.dataset.value = mode;
    if (mode === 'existing') { show($('[data-existing-form]')); hide($('[data-new-form]')); }
    else { show($('[data-new-form]')); hide($('[data-existing-form]')); }
  }
  $$('input[name="accept_mode"]').forEach(r => r.addEventListener('change', syncMode));

  /* ---------- validation ---------- */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  const PHONE_RE = /^\+?[0-9\s\-()]{7,20}$/;

  function fieldError(form, name, msg) {
    const f = form.querySelector(`[data-field="${name}"]`);
    if (!f) return;
    f.classList.toggle('has-error', !!msg);
    const slot = f.querySelector('[data-error]');
    if (slot) slot.textContent = msg || '';
  }

  function validateNew(form) {
    const errors = {};
    const name = form.elements.full_name.value.trim();
    if (name.length < 3) errors.full_name = 'Enter your full name.';
    const email = form.elements.email.value.trim();
    if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';
    const phone = form.elements.phone.value.trim();
    if (!PHONE_RE.test(phone) || phone.replace(/\D/g, '').length < 10) errors.phone = 'Enter a valid phone number.';
    const gender = (form.querySelector('input[name="gender"]:checked') || {}).value;
    if (!gender) errors.gender = 'Select your gender.';
    if (!form.elements.occupation.value) errors.occupation = 'Select your field.';
    if (!form.elements.age_range.value) errors.age_range = 'Select your age range.';
    Object.entries(errors).forEach(([k, v]) => fieldError(form, k, v));
    return { errors, gender };
  }

  /* ---------- accept: existing ---------- */
  $('[data-existing-form]') && $('[data-existing-form]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const id = form.elements.registration_id.value.trim().toUpperCase();
    if (!id || !/^SMS26/i.test(id)) {
      fieldError(form, 'registration_id', 'Enter the registration ID from your ticket, e.g. SMS26-K7QF-0102.');
      return;
    }
    fieldError(form, 'registration_id', '');
    await accept('existing', { mode: 'existing', registration_id: id }, $('[data-existing-label]'), 'Linking…');
  });

  /* ---------- accept: new ---------- */
  $('[data-new-form]') && $('[data-new-form]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const { errors, gender } = validateNew(form);
    if (Object.keys(errors).length) { toast('Please fix the highlighted fields.', { type: 'err' }); return; }
    const payload = {
      mode: 'new',
      registration: {
        full_name: form.elements.full_name.value.trim().replace(/\s+/g, ' '),
        email: form.elements.email.value.trim().toLowerCase(),
        phone: form.elements.phone.value.trim(),
        gender,
        marital_status: 'married',
        occupation: form.elements.occupation.value,
        age_range: form.elements.age_range.value,
        city: 'Port Harcourt'
      }
    };
    await accept('new', payload, $('[data-new-label]'), 'Creating your ticket…');
  });

  async function accept(kind, payload, labelEl, busyText) {
    const btns = $$('button[type="submit"]');
    btns.forEach(b => { b.disabled = true; b.setAttribute('aria-disabled', 'true'); });
    const original = labelEl ? labelEl.textContent : '';
    if (labelEl) labelEl.textContent = busyText;

    try {
      const res = await API.acceptInvite(token, payload);
      hide(acceptEl);
      show(doneEl);
      $('[data-done-id]').textContent = res.registration.registration_id;
      $('[data-done-spouse]').textContent = res.spouse.full_name + ' · ' + res.spouse.registration_id;
      $('[data-done-ticket]').href = 'success.html?id=' + encodeURIComponent(res.registration.registration_id);
      try { sessionStorage.setItem('sms_last_registration', JSON.stringify({ registration: res.registration, spouse_invite: null })); } catch (err) {}
      UI.burstPetals(70);
      toast('Registrations linked successfully.', { type: 'ok', title: 'You are linked' });
    } catch (err) {
      if (err.fields && kind === 'new') {
        const form = $('[data-new-form]');
        Object.entries(err.fields).forEach(([k, v]) => fieldError(form, k, v));
      }
      toast(err.message || 'We could not link these registrations.', { type: 'err' });
      if (err.code === 'invite_expired' || err.code === 'already_accepted') {
        setTimeout(() => invalidate(err.message), 900);
      }
    } finally {
      btns.forEach(b => { b.disabled = false; b.removeAttribute('aria-disabled'); });
      if (labelEl) labelEl.textContent = original;
    }
  }

  boot();
})();
