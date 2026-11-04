/* ============================================================
   SMS SUMMIT 2026 — UI engine
   Motion, overlays, canvas petals, QR rendering, micro-helpers
   ============================================================ */
(function () {
  'use strict';

  const CFG = window.SMS_CONFIG;
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const pad2 = (n) => String(n).padStart(2, '0');
  const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  function formatDate(iso, opts) {
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('en-GB', opts || { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function formatDateTime(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function timeAgo(iso) {
    const diff = (Date.now() - Date.parse(iso)) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
  }
  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function titleCase(s) {
    return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  /* ============================================================
     Toasts
     ============================================================ */
  let toastHost;
  function toast(message, opts) {
    opts = opts || {};
    if (!toastHost) {
      toastHost = document.getElementById('toasts');
      if (!toastHost) {
        toastHost = document.createElement('div');
        toastHost.id = 'toasts';
        document.body.appendChild(toastHost);
      }
    }
    const type = opts.type || 'info';
    const glyph = type === 'ok' ? '✓' : type === 'err' ? '!' : 'i';
    const el = document.createElement('div');
    el.className = 'toast toast--' + type;
    el.setAttribute('role', 'status');
    el.innerHTML = `<i>${glyph}</i><div>${opts.title ? `<strong>${escapeHtml(opts.title)}</strong>` : ''}<p>${escapeHtml(message)}</p></div>`;
    toastHost.appendChild(el);
    const life = opts.duration || 4600;
    const kill = () => {
      el.classList.add('is-out');
      setTimeout(() => el.remove(), 420);
    };
    const t = setTimeout(kill, life);
    el.addEventListener('click', () => { clearTimeout(t); kill(); });
  }

  /* ============================================================
     Modal
     ============================================================ */
  function openModal(id) {
    const m = typeof id === 'string' ? document.getElementById(id) : id;
    if (!m) return;
    m.classList.add('is-open');
    m.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-locked');
    const focusable = m.querySelector('input, button, select, textarea, a[href]');
    if (focusable) setTimeout(() => focusable.focus({ preventScroll: true }), 200);
  }
  function closeModal(id) {
    const m = typeof id === 'string' ? document.getElementById(id) : id;
    if (!m) return;
    m.classList.remove('is-open');
    m.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.modal.is-open') && !document.querySelector('.drawer-detail.is-open')) {
      document.body.classList.remove('is-locked');
    }
  }
  document.addEventListener('click', (e) => {
    const closer = e.target.closest('[data-modal-close]');
    if (closer) { e.preventDefault(); closeModal(closer.closest('.modal')); }
    const opener = e.target.closest('[data-modal-open]');
    if (opener) { e.preventDefault(); openModal(opener.getAttribute('data-modal-open')); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const open = document.querySelector('.modal.is-open');
      if (open) closeModal(open);
      document.body.classList.remove('menu-open');
      document.body.classList.remove('is-locked');
    }
  });

  /* ============================================================
     Scroll reveal
     ============================================================ */
  function initReveal(root) {
    const items = $$('.reveal', root || document);
    if (!('IntersectionObserver' in window) || REDUCED) {
      items.forEach(el => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    items.forEach(el => io.observe(el));
  }

  /* ============================================================
     Scroll progress + sticky nav + back-to-top + parallax
     ============================================================ */
  function initScroll() {
    const bar = $('#scroll-progress');
    const nav = $('.nav');
    const toTop = $('.to-top');
    let raf = null;

    const onScroll = () => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar) bar.style.setProperty('--p', max > 0 ? clamp(y / max, 0, 1) : 0);
      if (nav) nav.classList.toggle('is-stuck', y > 24);
      if (toTop) toTop.classList.toggle('is-on', y > 700);

      // gentle parallax on hero decorations
      if (!REDUCED) {
        const hero = $('.hero');
        if (hero && y < window.innerHeight * 1.2) {
          const p = y / window.innerHeight;
          const poster = $('.poster', hero);
          const hands = $('.hero__float--hands', hero);
          if (poster) poster.style.setProperty('--par', p.toFixed(3));
          if (hands) hands.style.translate = `0 ${p * 26}px`;
        }
      }
      raf = null;
    };
    window.addEventListener('scroll', () => {
      if (!raf) raf = requestAnimationFrame(onScroll);
    }, { passive: true });
    onScroll();

    if (toTop) toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }));
  }

  /* ============================================================
     Falling petals — canvas, dynamic and device aware
     ============================================================ */
  function initPetals() {
    if (REDUCED) return;
    const canvas = document.getElementById('petals');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    let petals = [];
    let running = true;
    let mouse = { x: -999, y: -999 };

    const PALETTE = [
      ['#f6e2c8', 0.5], ['#e8c9a8', 0.42], ['#ffffff', 0.16],
      ['#d0202f', 0.28], ['#9b0f19', 0.3]
    ];

    function makePetal(randomY) {
      const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      return {
        x: Math.random() * W,
        y: randomY ? Math.random() * H : -30 - Math.random() * 120,
        size: 10 + Math.random() * 16,
        speed: 0.25 + Math.random() * 0.75,
        drift: -0.35 + Math.random() * 0.7,
        spin: -0.012 + Math.random() * 0.024,
        angle: Math.random() * Math.PI * 2,
        sway: Math.random() * Math.PI * 2,
        swaySpeed: 0.006 + Math.random() * 0.012,
        alpha: color[1] * (0.6 + Math.random() * 0.4),
        color: color[0],
        depth: 0.45 + Math.random() * 0.55
      };
    }

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const density = W < 640 ? 16 : W < 1100 ? 26 : 38;
      petals = Array.from({ length: density }, () => makePetal(true));
    }

    function drawPetal(p) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      const w = p.size, h = p.size * 0.55;
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.5);
      ctx.bezierCurveTo(w * 0.55, -h * 0.45, w * 0.42, h * 0.7, 0, h * 0.5);
      ctx.bezierCurveTo(-w * 0.42, h * 0.7, -w * 0.55, -h * 0.45, 0, -h * 0.5);
      ctx.fill();
      // fine centre vein
      ctx.globalAlpha = p.alpha * 0.4;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.35);
      ctx.lineTo(0, h * 0.35);
      ctx.stroke();
      ctx.restore();
    }

    function frame() {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      for (const p of petals) {
        p.sway += p.swaySpeed;
        p.x += p.drift + Math.sin(p.sway) * 0.55;
        p.y += p.speed * (0.6 + p.depth);
        p.angle += p.spin;

        // gentle repulsion around the cursor
        const dx = p.x - mouse.x, dy = p.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 14000 && d2 > 1) {
          const d = Math.sqrt(d2);
          const force = (120 - d) / 120;
          p.x += (dx / d) * force * 2.4;
          p.y += (dy / d) * force * 1.4;
        }

        if (p.y > H + 40) { Object.assign(p, makePetal(false)); p.x = Math.random() * W; }
        if (p.x < -60) p.x = W + 40;
        if (p.x > W + 60) p.x = -40;
        drawPetal(p);
      }
      requestAnimationFrame(frame);
    }

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
    window.addEventListener('mouseleave', () => { mouse.x = mouse.y = -999; });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { running = false; }
      else if (!running) { running = true; frame(); }
    });

    resize();
    frame();
  }

  /* ============================================================
     Celebration petals (success page)
     ============================================================ */
  function burstPetals(intensity) {
    if (REDUCED) return;
    const canvas = document.getElementById('confetti');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.width = window.innerWidth * dpr;
    const H = canvas.height = window.innerHeight * dpr;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = window.innerWidth, h = window.innerHeight;

    const colors = ['#f6e2c8', '#e8c9a8', '#ffffff', '#d0202f', '#9b0f19', '#f4b8c0'];
    const count = intensity || 70;
    const parts = Array.from({ length: count }, () => ({
      x: w * (0.42 + Math.random() * 0.16),
      y: h * 0.32,
      vx: (Math.random() - 0.5) * 11,
      vy: -Math.random() * 9 - 2,
      g: 0.13 + Math.random() * 0.1,
      size: 6 + Math.random() * 10,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.22,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1
    }));

    let start = performance.now();
    function tick(t) {
      const elapsed = t - start;
      ctx.clearRect(0, 0, w, h);
      parts.forEach(p => {
        p.vy += p.g;
        p.vx *= 0.995;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life = clamp(1 - elapsed / 4200, 0, 1);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.life * 0.9;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 0.5, p.size * 0.26, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      if (elapsed < 4600) requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, w, h);
    }
    requestAnimationFrame(tick);
  }

  /* ============================================================
     Countdown
     ============================================================ */
  function initCountdown() {
    const host = $('[data-countdown]');
    if (!host) return;
    const target = Date.parse(CFG.EVENT.dateISO);
    const cells = [
      { key: 'd', label: 'Days' },
      { key: 'h', label: 'Hours' },
      { key: 'm', label: 'Minutes' },
      { key: 's', label: 'Seconds' }
    ];
    host.innerHTML = cells.map(c => `
      <div class="cd-cell">
        <span class="cd-num" data-cd="${c.key}">00</span>
        <span class="cd-label">${c.label}</span>
      </div>`).join('');

    const prev = {};
    function tick() {
      const diff = target - Date.now();
      const t = diff > 0 ? {
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff / 3600000) % 24),
        m: Math.floor((diff / 60000) % 60),
        s: Math.floor((diff / 1000) % 60)
      } : { d: 0, h: 0, m: 0, s: 0 };

      Object.entries(t).forEach(([k, v]) => {
        const el = host.querySelector(`[data-cd="${k}"]`);
        if (!el) return;
        const next = k === 'd' ? String(v) : pad2(v);
        if (prev[k] !== next) {
          el.textContent = next;
          el.classList.remove('is-tick');
          void el.offsetWidth;
          el.classList.add('is-tick');
          prev[k] = next;
        }
      });
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ============================================================
     QR codes
     ============================================================ */
  function renderQR(canvas, text, opts) {
    opts = opts || {};
    if (!canvas || !window.QRCodeLib) return Promise.resolve();
    return window.QRCodeLib.toCanvas(canvas, text || 'SMS26', {
      margin: opts.margin === undefined ? 1 : opts.margin,
      width: opts.width || 300,
      errorCorrectionLevel: 'M',
      color: {
        dark: opts.dark || '#4a070b',
        light: opts.light || '#fbf4ec'
      }
    }).catch(err => console.warn('QR render failed', err));
  }

  /* ============================================================
     Clipboard + small utilities
     ============================================================ */
  async function copy(text, successMsg) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      toast(successMsg || 'Copied to clipboard', { type: 'ok', duration: 2400 });
      return true;
    } catch (e) {
      toast('Could not copy — please select and copy manually.', { type: 'err' });
      return false;
    }
  }

  function downloadCanvas(canvas, filename) {
    if (!canvas) return;
    canvas.toBlob(blob => {
      if (blob) window.downloadBlob(blob, filename);
    }, 'image/png');
  }

  /* ============================================================
     Page transitions between .html documents
     ============================================================ */
  function initPageTransitions() {
    document.body.classList.add('is-ready');
    const veil = document.getElementById('veil');
    if (veil) {
      veil.classList.add('is-opening');
      setTimeout(() => veil.classList.remove('is-opening'), 950);
    }
    if (!veil || REDUCED) return;

    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || a.hasAttribute('download')) return;
      if (href.includes('.html') || href === '/' || !href.includes('.')) {
        // let clearly-decorative links pass
        if (a.dataset.noTransition !== undefined) return;
        e.preventDefault();
        veil.classList.remove('is-opening');
        veil.classList.add('is-closing');
        setTimeout(() => { window.location.href = href; }, 620);
      }
    });
    window.addEventListener('pageshow', () => {
      veil.classList.remove('is-closing');
    });
  }

  /* ============================================================
     Boot shared UI
     ============================================================ */
  function boot() {
    initScroll();
    initPetals();
    initCountdown();
    initReveal();
    initPageTransitions();
    // hide the preloader once paint settles
    const ready = () => {
      requestAnimationFrame(() => {
        document.body.classList.add('is-ready');
        const pre = document.getElementById('preloader');
        if (pre) setTimeout(() => pre.remove(), 900);
      });
    };
    if (document.readyState === 'complete') ready();
    else window.addEventListener('load', ready);
    setTimeout(ready, 2600); // safety net
  }

  window.SMSUI = {
    $, $$, clamp, pad2, initials, formatDate, formatDateTime, timeAgo,
    escapeHtml, titleCase, toast, openModal, closeModal,
    initReveal, initPetals, burstPetals, initCountdown, renderQR,
    copy, downloadCanvas, initScroll, REDUCED
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
