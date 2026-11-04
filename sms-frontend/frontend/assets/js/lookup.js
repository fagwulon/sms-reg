/* ============================================================
   SMS SUMMIT 2026 — Ticket lookup
   ============================================================ */
(function () {
  'use strict';

  const UI = window.SMSUI;
  const API = window.SMSApi;
  const { $, toast, copy, initials, titleCase, formatDate } = UI;

  const form = $('[data-lookup-form]');
  if (!form) return;

  const input = form.elements.registration_id;
  const resultEl = $('[data-result]');
  const emptyEl = $('[data-empty]');
  const submitBtn = $('[data-lookup-submit]');
  const label = $('[data-lookup-label]');
  let found = null;

  input.addEventListener('input', () => {
    input.value = input.value.toUpperCase();
    clearError();
  });

  function setError(msg) {
    const field = form.querySelector('[data-field="registration_id"]');
    field.classList.toggle('has-error', !!msg);
    field.querySelector('[data-error]').textContent = msg || '';
  }
  function clearError() { setError(''); }

  async function lookup(id) {
    if (!id) { setError('Enter your registration ID.'); return; }
    if (!/^SMS26-[A-Z0-9]{4}-\d{3,5}$/i.test(id) && !/^SMS26/i.test(id)) {
      setError('That doesn\'t look like a registration ID. It starts with SMS26-.');
      return;
    }
    clearError();
    submitBtn.disabled = true;
    submitBtn.setAttribute('aria-disabled', 'true');
    if (label) label.textContent = 'Searching…';

    try {
      const reg = await API.getRegistration(id.trim());
      found = reg;
      paint(reg);
      resultEl.classList.remove('hidden');
      emptyEl.classList.add('hidden');
      resultEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      found = null;
      resultEl.classList.add('hidden');
      emptyEl.classList.remove('hidden');
      const msg = $('[data-empty-msg]');
      if (msg) msg.textContent = err.status === 404
        ? 'No registration matches that ID. Check the ID and try again.'
        : (err.message || 'Something went wrong. Please try again.');
      if (err.status === 404) setError('No registration matches that ID.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.removeAttribute('aria-disabled');
      if (label) label.textContent = 'Find ticket';
    }
  }

  function paint(reg) {
    $('[data-name]').textContent = reg.full_name;
    $('[data-sub]').textContent = `${titleCase(reg.gender)} · ${titleCase(reg.marital_status)}${reg.occupation ? ' · ' + reg.occupation : ''}`;
    $('[data-initials]').textContent = initials(reg.full_name);
    $('[data-id]').textContent = reg.registration_id;
    $('[data-email]').textContent = reg.email;
    $('[data-phone]').textContent = reg.phone;
    $('[data-marital]').textContent = titleCase(reg.marital_status);
    $('[data-registered-at]').textContent = 'Registered ' + formatDate(reg.created_at);

    const status = $('[data-status]');
    status.textContent = UI.titleCase(reg.status.replace('_', ' '));
    status.className = 'status-pill' + (reg.status === 'checked_in' ? '' : reg.status === 'cancelled' ? ' status-pill--off' : ' status-pill--wait');

    const spouse = $('[data-spouse]');
    if (reg.spouse) {
      spouse.classList.remove('hidden');
      $('[data-spouse-name]').textContent = reg.spouse.full_name;
      $('[data-spouse-id]').textContent = reg.spouse.registration_id + ' · linked spouse';
    } else {
      spouse.classList.add('hidden');
    }

    const open = $('[data-open-ticket]');
    open.href = 'success.html?id=' + encodeURIComponent(reg.registration_id);

    const ci = $('[data-checkin]');
    if (reg.status === 'checked_in') {
      ci.disabled = true;
      ci.setAttribute('aria-disabled', 'true');
      $('[data-checkin-note]').textContent = 'You are already checked in. See you at the summit!';
    } else {
      ci.disabled = false;
      ci.removeAttribute('aria-disabled');
      $('[data-checkin-note]').textContent = 'Self check-in marks you as present. The desk can also scan your QR on arrival.';
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    lookup(input.value.trim().toUpperCase());
  });

  $('[data-copy-ticket-id]') && $('[data-copy-ticket-id]').addEventListener('click', () => {
    if (found) copy(found.registration_id, 'Registration ID copied');
  });

  $('[data-checkin]') && $('[data-checkin]').addEventListener('click', async (e) => {
    if (!found) return;
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const reg = await API.checkIn(found.registration_id);
      found = reg;
      paint(reg);
      toast('Checked in. Enjoy the summit!', { type: 'ok', title: 'You are in' });
    } catch (err) {
      toast(err.message || 'Check-in failed.', { type: 'err' });
      btn.disabled = false;
    }
  });

  /* deep link: lookup.html?id=… fills and searches automatically */
  const qid = new URLSearchParams(location.search).get('id');
  if (qid) {
    input.value = qid.toUpperCase();
    lookup(input.value);
  }
})();
