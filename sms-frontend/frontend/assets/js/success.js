/* ============================================================
   SMS SUMMIT 2026 — Ticket page
   Renders the attendee ticket, QR, download, share and the
   secure spouse-invitation flow.
   ============================================================ */
(function () {
  'use strict';

  const UI = window.SMSUI;
  const API = window.SMSApi;
  const { $, $$, toast, copy, renderQR, formatDateTime } = UI;

  const params = new URLSearchParams(location.search);
  const regId = (params.get('id') || '').trim();
  const isNew = params.get('new') === '1';

  const loadingEl = $('[data-loading]');
  const errorEl = $('[data-error]');
  const contentEl = $('[data-content]');

  let current = null;

  function show(el) { el && el.classList.remove('hidden'); }
  function hide(el) { el && el.classList.add('hidden'); }

  function fail(message) {
    hide(loadingEl); hide(contentEl); show(errorEl);
    const m = $('[data-error-msg]');
    if (m && message) m.textContent = message;
  }

  /* ---------- render ---------- */
  async function load() {
    if (!regId) {
      // fall back to the most recent registration created in this browser
      let cached = null;
      try { cached = JSON.parse(sessionStorage.getItem('sms_last_registration') || 'null'); } catch (e) {}
      if (cached && cached.registration) {
        current = cached.registration;
        render(cached.registration, normaliseInvite(cached.spouse_invite));
        return;
      }
      fail('No registration was specified. If you just registered, check the link in your confirmation.');
      return;
    }

    try {
      const reg = await API.getRegistration(regId);
      let invite = normaliseInvite(reg.pending_invite || reg.spouse_invite || null);
      let cached = null;
      try { cached = JSON.parse(sessionStorage.getItem('sms_last_registration') || 'null'); } catch (e) {}
      if (!invite && cached && cached.spouse_invite && cached.registration &&
          cached.registration.registration_id === reg.registration_id) {
        invite = normaliseInvite(cached.spouse_invite);
      }
      current = reg;
      render(reg, invite);
    } catch (err) {
      fail(err.message || 'We could not load that registration.');
    }
  }

  function render(reg, invite) {
    hide(loadingEl);
    show(contentEl);

    $('[data-name]').textContent = reg.full_name;
    $('[data-reg-id]').textContent = reg.registration_id;

    const qr = $('[data-qr]');
    renderQR(qr, reg.qr_payload || ('SMS26|' + reg.registration_id), {
      width: 420, margin: 1, dark: '#4a070b', light: '#ffffff'
    });

    if (!isNew) {
      const msg = $('[data-confirm-msg]');
      if (msg) msg.innerHTML = `Here is your ticket for the <b>Singles &amp; Married Summit 2026</b>. Show this QR at the door.`;
    } else {
      UI.burstPetals(90);
      setTimeout(() => UI.burstPetals(50), 700);
    }

    // spouse section state
    const block = $('[data-spouse-block]');
    if (reg.marital_status !== 'married') {
      hide(block);
    } else if (reg.spouse) {
      show($('[data-spouse-linked]'));
      hide($('[data-spouse-action]'));
      hide($('[data-invite-box]'));
      hide($('[data-invite-pending]'));
      $('[data-spouse-name]').textContent = reg.spouse.full_name;
      $('[data-spouse-meta]').textContent = `${reg.spouse.registration_id} · linked`;
      $('[data-spouse-copy]').textContent = 'Your spouse is linked to this registration. You both keep separate IDs, QR tickets and check-in records.';
    } else {
      const usable = normaliseInvite(invite);
      if (usable) paintInvite(usable);
    }

    if (isNew) {
      contentEl.animate(
        [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }],
        { duration: 700, easing: 'cubic-bezier(.16,1,.3,1)' }
      );
    }
  }

  /* the backend (and the mock) may return an invite nested under
     spouse_invite / invite / pending_invite — normalise it */
  function normaliseInvite(raw) {
    if (!raw) return null;
    const inv = raw.spouse_invite || raw.invite || raw.pending_invite || raw;
    if (!inv || !inv.token) return null;
    const base = location.origin + location.pathname.replace(/[^/]*$/, '');
    let url = inv.invite_url || inv.url || (base + 'invite.html?token=' + encodeURIComponent(inv.token));
    // preview mode: carry a signed snapshot so the link works on any device
    try {
      const pack = API.shareInvite(inv.token);
      if (pack) {
        url = url.replace(/([?&])p=[^&]*/g, '$1').replace(/[?&]$/, '');
        url += (url.includes('?') ? '&' : '?') + 'p=' + encodeURIComponent(pack);
      }
    } catch (e) {}
    return {
      token: inv.token,
      status: inv.status || 'pending',
      expires_at: inv.expires_at || null,
      invite_url: url,
      display_url: base.replace(/^https?:\/\//, '') + 'invite?token=' + inv.token.slice(0, 6) + '…'
    };
  }

  function paintInvite(invite) {
    hide($('[data-spouse-action]'));
    hide($('[data-invite-pending]'));
    show($('[data-invite-box]'));
    const input = $('[data-invite-url]');
    input.value = invite.invite_url;
    input.dataset.token = invite.token || '';
    input.dataset.full = invite.invite_url;
    const exp = invite.expires_at ? new Date(invite.expires_at) : null;
    if (exp) {
      const hrs = Math.max(0, Math.round((exp - Date.now()) / 3600000));
      $('[data-expiry]').textContent = hrs > 1 ? `Expires in ${hrs} hours` : 'Expires soon';
    }
    const status = $('[data-invite-status]');
    if (status) status.textContent = 'Ready to send';
  }

  /* ---------- actions ---------- */
  const ticket = $('[data-ticket]');

  $('[data-download]') && $('[data-download]').addEventListener('click', () => {
    if (!current) return;
    downloadTicket(current);
  });

  $('[data-copy-id]') && $('[data-copy-id]').addEventListener('click', () => {
    if (!current) return;
    copy(current.registration_id, 'Registration ID copied');
  });

  $('[data-share]') && $('[data-share]').addEventListener('click', async () => {
    if (!current) return;
    const shareUrl = location.href.split('&new=1')[0];
    const data = {
      title: 'Singles & Married Summit 2026',
      text: `${current.full_name} is registered for the Singles & Married Summit 2026 — 15 Nov, 4PM WAT.`,
      url: shareUrl
    };
    if (navigator.share) {
      try { await navigator.share(data); return; } catch (e) { /* user cancelled */ }
    }
    copy(shareUrl, 'Ticket link copied');
  });

  $('[data-print]') && $('[data-print]').addEventListener('click', () => {
    document.body.classList.add('printing');
    setTimeout(() => window.print(), 120);
  });
  window.addEventListener('afterprint', () => document.body.classList.remove('printing'));

  $('[data-create-invite]') && $('[data-create-invite]').addEventListener('click', async (e) => {
    if (!current) return;
    const btn = e.currentTarget;
    btn.setAttribute('aria-disabled', 'true');
    const original = btn.innerHTML;
    btn.innerHTML = '<span class="spin"></span> Creating…';
    try {
      const invite = normaliseInvite(await API.createInvite(current.registration_id));
      paintInvite(invite);
      toast('Invitation created — copy the link and send it to your spouse.', { type: 'ok', title: 'Ready to share' });
    } catch (err) {
      toast(err.message || 'Could not create the invitation.', { type: 'err' });
      btn.innerHTML = original;
      btn.removeAttribute('aria-disabled');
    }
  });

  $('[data-copy-invite]') && $('[data-copy-invite]').addEventListener('click', () => {
    const v = $('[data-invite-url]').value;
    if (v) copy(v, 'Invitation link copied');
  });

  $('[data-share-invite]') && $('[data-share-invite]').addEventListener('click', async () => {
    const url = $('[data-invite-url]').value;
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me at the Singles & Married Summit 2026',
          text: 'Accept my spouse invitation so our registrations are linked — you keep your own ticket and QR.',
          url
        });
        return;
      } catch (e) {}
    }
    copy(url, 'Invitation link copied');
  });

  $('[data-revoke-invite]') && $('[data-revoke-invite]').addEventListener('click', async () => {
    const token = $('[data-invite-url]').dataset.token;
    if (!token) return;
    try {
      await API.revokeInvite(token);
      hide($('[data-invite-box]'));
      show($('[data-spouse-action]'));
      const s = $('[data-invite-status]');
      if (s) s.textContent = '';
      toast('Invitation revoked. You can create a new one anytime.', { type: 'info' });
    } catch (err) {
      toast(err.message || 'Could not revoke the invitation.', { type: 'err' });
    }
  });

  /* ---------- ticket image ---------- */
  async function downloadTicket(reg) {
    const W = 1080, H = 1350;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');

    /* ---------- backdrop ---------- */
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#140607');
    bg.addColorStop(0.5, '#2c0709');
    bg.addColorStop(1, '#0d0506');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(W * 0.82, H * 0.08, 20, W * 0.82, H * 0.08, W * 0.85);
    glow.addColorStop(0, 'rgba(208,32,47,0.5)');
    glow.addColorStop(1, 'rgba(208,32,47,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // soft petal accents
    const petals = [[120, 190, 26, -0.5], [980, 1180, 20, 0.9], [90, 1130, 16, 0.3], [1010, 210, 14, -0.2]];
    petals.forEach(([px, py, r, rot]) => {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(rot);
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = '#e8c9a8';
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    /* ---------- card ---------- */
    const x = 64, y = 96, w = W - 128, h = H - 230;
    roundRect(ctx, x, y, w, h, 38);
    const cardBg = ctx.createLinearGradient(x, y, x + w, y + h);
    cardBg.addColorStop(0, '#fdf7f0');
    cardBg.addColorStop(0.6, '#f8eee2');
    cardBg.addColorStop(1, '#efdcca');
    ctx.fillStyle = cardBg;
    ctx.fill();

    /* ---------- crimson header ---------- */
    const headerH = 132;
    ctx.save();
    roundRect(ctx, x, y, w, headerH, 38, true);
    const band = ctx.createLinearGradient(x, y, x + w, y);
    band.addColorStop(0, '#4a070b');
    band.addColorStop(0.45, '#8b0e17');
    band.addColorStop(1, '#5d0910');
    ctx.fillStyle = band;
    ctx.fill();
    ctx.restore();

    // real brush wordmark
    let wordmark = null;
    try {
      wordmark = await loadImage('assets/img/wordmark.webp');
    } catch (e) { /* fall back to type below */ }
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, headerH);
    ctx.clip();
    if (wordmark && wordmark.width) {
      const mh = 58;
      const mw = (wordmark.width / wordmark.height) * mh;
      ctx.drawImage(wordmark, x + 44, y + (headerH - mh) / 2, mw, mh);
    } else {
      ctx.fillStyle = '#fbf4ec';
      ctx.font = 'italic 66px Georgia, serif';
      ctx.textAlign = 'left';
      ctx.fillText('SMS', x + 44, y + 88);
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(251,244,236,0.92)';
    ctx.font = '400 25px "Bebas Neue", Arial, sans-serif';
    ctx.fillText('SINGLES  &  MARRIED  SUMMIT  2026', x + w - 44, y + 58);
    ctx.fillStyle = 'rgba(232,201,168,0.85)';
    ctx.font = '400 19px Arial, sans-serif';
    ctx.fillText('THE MARITAL BLUEPRINT', x + w - 44, y + 88);
    ctx.restore();

    /* ---------- attendee ---------- */
    let cy = y + headerH + 58;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9b0f19';
    ctx.font = '600 17px Arial, sans-serif';
    ctx.fillText('ADMIT ONE  ·  ATTENDEE', x + 52, cy);

    cy += 58;
    ctx.fillStyle = '#3f070b';
    ctx.font = '600 56px Georgia, "Times New Roman", serif';
    const nameLines = wrapText(ctx, reg.full_name, x + 52, cy, w - 340, 60);
    cy = nameLines;

    /* ---------- QR block ---------- */
    const qrSize = 250;
    const qx = x + w - qrSize - 52;
    const qy = y + headerH + 62;
    roundRect(ctx, qx - 16, qy - 16, qrSize + 32, qrSize + 32, 22);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(74,7,11,0.12)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const qrCanvas = document.createElement('canvas');
    try {
      await window.QRCodeLib.toCanvas(qrCanvas, reg.qr_payload || ('SMS26|' + reg.registration_id), {
        margin: 1, width: 500, color: { dark: '#4a070b', light: '#ffffff' }
      });
      ctx.drawImage(qrCanvas, qx, qy, qrSize, qrSize);
    } catch (e) { console.warn('QR for ticket failed', e); }
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(74,7,11,0.55)';
    ctx.font = '600 14px Arial, sans-serif';
    ctx.fillText('SCAN AT THE DOOR', qx + qrSize / 2, qy + qrSize + 44);
    ctx.textAlign = 'left';

    /* ---------- details ---------- */
    let dy = Math.max(cy + 58, qy + qrSize + 92);
    const items = [
      ['DATE', ['Sunday, 15 November 2026']],
      ['TIME', ['4:00PM WAT', 'Doors open 3:00PM']],
      ['VENUE', ['Top Floor, Elyon Primary School']],
      ['ADDRESS', ['10 Ichiegbo Street, Off Psychiatric Road,', 'Rumuorosi, Port Harcourt']],
      ['TICKET TYPE', ['General Admission · Free']],
      ['REGISTERED', [new Date(reg.created_at || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })]]
    ];
    const gutter = 40;
    const colW = (w - 104 - gutter) / 2;
    const colX = [x + 52, x + 52 + colW + gutter];
    let col = 0;
    items.forEach(([label, lines]) => {
      const cx = colX[col];
      ctx.fillStyle = 'rgba(74,7,11,0.5)';
      ctx.font = '600 14px Arial, sans-serif';
      ctx.fillText(label, cx, dy);
      ctx.fillStyle = '#3f070b';
      ctx.font = '500 21px Arial, sans-serif';
      lines.forEach((ln, i) => {
        fitLines(ctx, ln, colW - 8).forEach((frag, j) => {
          ctx.fillText(frag, cx, dy + 30 + (i + j) * 26);
        });
      });
      const height = 34 + lines.length * 26;
      if (col === 0) { col = 1; } else { col = 0; dy += Math.max(height, 74); }
    });

    /* ---------- attendee contact line ---------- */
    const contactY = y + h - 176;
    ctx.fillStyle = 'rgba(74,7,11,0.45)';
    ctx.font = '500 17px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(reg.email, x + 52, contactY);
    if (reg.phone) {
      ctx.textAlign = 'right';
      ctx.fillText(reg.phone, x + w - 52, contactY);
      ctx.textAlign = 'left';
    }

    /* ---------- perforation & ID ---------- */
    const py = y + h - 128;
    ctx.save();
    ctx.strokeStyle = 'rgba(74,7,11,0.28)';
    ctx.setLineDash([12, 12]);
    ctx.beginPath();
    ctx.moveTo(x + 26, py);
    ctx.lineTo(x + w - 26, py);
    ctx.stroke();
    ctx.restore();

    // punched notches at the tear line
    [-1, 1].forEach(side => {
      ctx.beginPath();
      ctx.arc(side === -1 ? x : x + w, py, 15, 0, Math.PI * 2);
      ctx.fillStyle = '#1b0709';
      ctx.fill();
    });

    ctx.fillStyle = 'rgba(74,7,11,0.55)';
    ctx.font = '600 15px Arial, sans-serif';
    ctx.fillText('REGISTRATION ID', x + 52, py + 46);
    ctx.fillStyle = '#650a10';
    ctx.font = '400 44px "Courier New", monospace';
    ctx.fillText(reg.registration_id, x + 52, py + 94);

    /* ---------- footer ---------- */
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(251,244,236,0.55)';
    ctx.font = '400 19px Inter, Arial, sans-serif';
    ctx.fillText('The Potters Tribe  ·  True Worshippers Assembly  ·  smssummit26.com', W / 2, H - 66);
    ctx.fillStyle = 'rgba(232,201,168,0.45)';
    ctx.font = '400 15px Arial, sans-serif';
    ctx.fillText('ONE SUMMIT  ·  TWO JOURNEYS  ·  ONE BLUEPRINT', W / 2, H - 38);

    c.toBlob(blob => {
      if (blob) window.downloadBlob(blob, `SMS26-ticket-${reg.registration_id}.png`);
      toast('Ticket downloaded', { type: 'ok' });
    }, 'image/png');
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function fitLines(ctx, text, maxWidth) {
    const words = String(text).split(' ');
    const lines = [];
    let line = '';
    words.forEach(word => {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = test;
    });
    if (line) lines.push(line);
    return lines;
  }

  function roundRect(ctx, x, y, w, h, r, topOnly) {
    ctx.beginPath();
    if (topOnly) {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
    } else {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
    }
    ctx.closePath();
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = String(text).split(' ');
    let line = '';
    let yy = y;
    words.forEach((word, i) => {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && i > 0) {
        ctx.fillText(line, x, yy);
        line = word;
        yy += lineHeight;
      } else {
        line = test;
      }
    });
    if (line) ctx.fillText(line, x, yy);
    return yy;
  }

  /* ---------- keyboard shortcut: reveal ticket id ---------- */
  document.addEventListener('copy', (e) => {
    // no-op guard, keeps clipboard API path predictable
  });

  load();
})();
