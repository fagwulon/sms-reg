/* ============================================================
   SMS SUMMIT 2026 — Home interactions
   ============================================================ */
(function () {
  'use strict';

  const { $, $$, toast, copy, renderQR, initReveal, burstPetals } = window.SMSUI;
  const CFG = window.SMS_CONFIG;

  /* ---------- Show "preview mode" badges when using the mock ---------- */
  function paintMode() {
    if (!window.SMSApi || !window.SMSApi.isMock()) return;
    $$('[data-mock-badge]').forEach(el => { el.hidden = false; });
  }

  /* ---------- Mobile drawer ---------- */
  function initMenu() {
    const burger = $('[data-burger]');
    if (!burger) return;
    const toggle = (force) => {
      const open = force !== undefined ? force : !document.body.classList.contains('menu-open');
      document.body.classList.toggle('menu-open', open);
      document.body.classList.toggle('is-locked', open);
      burger.setAttribute('aria-expanded', String(open));
      const drawer = $('[data-drawer]');
      if (drawer) drawer.setAttribute('aria-hidden', String(!open));
    };
    burger.addEventListener('click', () => toggle());
    $$('[data-drawer] a').forEach(a => a.addEventListener('click', () => toggle(false)));
    window.addEventListener('resize', () => { if (window.innerWidth > 1024) toggle(false); });
  }

  /* ---------- Nav active state on scroll ---------- */
  function initNavSpy() {
    const links = $$('.nav__link[href^="#"]');
    if (!links.length || !('IntersectionObserver' in window)) return;
    const map = new Map();
    links.forEach(l => {
      const id = l.getAttribute('href').slice(1);
      const sec = document.getElementById(id);
      if (sec) map.set(sec, l);
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const link = map.get(entry.target);
        if (!link) return;
        if (entry.isIntersecting) {
          links.forEach(l => l.classList.remove('is-active'));
          link.classList.add('is-active');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((_, sec) => io.observe(sec));
  }

  /* ---------- Poster 3D tilt ---------- */
  function initTilt() {
    const poster = $('[data-tilt]');
    const stage = $('[data-stage]');
    if (!poster || !stage) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(hover: none)').matches) return;

    let raf = null;
    let target = { x: 0, y: 0 };
    let current = { x: 0, y: 0 };

    const onMove = (e) => {
      const r = stage.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      target.x = px * 14;
      target.y = py * -12;
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const onLeave = () => {
      target.x = 0; target.y = 0;
      if (!raf) raf = requestAnimationFrame(loop);
    };
    function loop() {
      current.x += (target.x - current.x) * 0.09;
      current.y += (target.y - current.y) * 0.09;
      poster.style.setProperty('--rx', current.x.toFixed(2));
      poster.style.setProperty('--ry', current.y.toFixed(2));
      if (Math.abs(target.x - current.x) > 0.05 || Math.abs(target.y - current.y) > 0.05) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = null;
      }
    }
    stage.addEventListener('mousemove', onMove);
    stage.addEventListener('mouseleave', onLeave);
  }

  /* ---------- Stat counters ---------- */
  function initCounters() {
    const els = $$('[data-count]');
    if (!els.length) return;
    const run = (el) => {
      const end = parseFloat(el.dataset.count);
      const dur = 1500;
      const start = performance.now();
      const decimals = (el.dataset.count.split('.')[1] || '').length;
      const step = (t) => {
        const p = Math.min(1, (t - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (end * eased).toFixed(decimals);
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = end.toFixed(decimals);
      };
      requestAnimationFrame(step);
    };
    if (!('IntersectionObserver' in window)) { els.forEach(run); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0.5 });
    els.forEach(el => io.observe(el));
  }

  /* ---------- Duplicate marquee content for a seamless loop ---------- */
  function initMarquee() {
    $$('[data-marquee]').forEach(track => {
      const group = track.querySelector('.marquee__group');
      if (!group) return;
      track.appendChild(group.cloneNode(true));
    });
  }

  /* ---------- FAQ accordion ---------- */
  function initFaq() {
    $$('[data-faq] .faq-q').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        const open = item.classList.contains('is-open');
        $$('[data-faq] .faq-item').forEach(i => {
          i.classList.remove('is-open');
          const q = i.querySelector('.faq-q');
          if (q) q.setAttribute('aria-expanded', 'false');
        });
        if (!open) {
          item.classList.add('is-open');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  /* ---------- Demo QR codes in the linking section ---------- */
  function initDemoQR() {
    $$('[data-demo-qr]').forEach(host => {
      const canvas = document.createElement('canvas');
      host.appendChild(canvas);
      renderQR(canvas, host.dataset.demoQr, { width: 160, margin: 1, dark: '#4a070b', light: '#ffffff' });
    });
  }

  /* ---------- Copy demo invite link ---------- */
  function initCopyDemo() {
    const btn = $('[data-copy-demo]');
    if (!btn) return;
    btn.addEventListener('click', () => {
      copy('https://smssummit26.com/invite?token=INV8F3K2L9QX', 'Invitation link copied');
      btn.textContent = 'Copied';
      setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
    });
  }

  /* ---------- Hero: simulate a live registration ticker ---------- */
  function initMiniTicket() {
    const el = $('[data-mini-id]');
    if (!el) return;
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const rand = () => Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
    let n = 1042;
    const update = () => {
      el.textContent = `SMS26-${rand()}-${n}`;
      n += Math.floor(1 + Math.random() * 3);
    };
    update();
    setInterval(update, 5200);
  }

  /* ---------- Hero: gentle entrance stagger for non-reveal elements ---------- */
  function initEntrance() {
    document.body.classList.add('is-ready');
  }

  /* ---------- Keyboard: press "/" to focus search on lookup ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    paintMode();
    initMenu();
    initNavSpy();
    initTilt();
    initCounters();
    initMarquee();
    initFaq();
    initDemoQR();
    initCopyDemo();
    initMiniTicket();
    initEntrance();
    initReveal();
  });

  /* celebrate a little when the register CTA is hovered for a while — subtle life */
  let hoverTimer;
  document.addEventListener('mouseover', (e) => {
    const cta = e.target.closest('.hero__cta .btn--lg');
    if (!cta) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => burstPetals(18), 900);
  });

  window.addEventListener('load', () => {
    // underline sketches draw in once their section is visible
    const u = $('.underline-sketch');
    if (u) u.classList.add('is-visible');
  });
})();
