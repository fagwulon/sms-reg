/* ============================================================
   SMS SUMMIT 2026 — Inline icon sprite
   Injected once so every page can use <use href="#i-name">
   with zero network requests (works offline & in sandboxes).
   ============================================================ */
(function () {
  const icon = (id, body, viewBox) =>
    `<symbol id="${id}" viewBox="${viewBox || '0 0 24 24'}">${body}</symbol>`;

  const sprite = `
<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">
  ${icon('i-calendar', `<rect x="3" y="5" width="18" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 10h18M8 3v4M16 3v4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`)}
  ${icon('i-clock', `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 7v5l3.5 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`)}
  ${icon('i-pin', `<path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/>`)}
  ${icon('i-arrow', `<path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`)}
  ${icon('i-arrow-up', `<path d="M12 19V5M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`)}
  ${icon('i-check', `<path d="M4 12.5 9.5 18 20 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`)}
  ${icon('i-check-circle', `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 12.5l2.6 2.6L16 9.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`)}
  ${icon('i-lock', `<rect x="4.5" y="10" width="15" height="10.5" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="15.2" r="1.3" fill="currentColor"/>`)}
  ${icon('i-heart', `<path d="M12 20.5S3.5 15 3.5 9.2A4.7 4.7 0 0 1 12 6.4a4.7 4.7 0 0 1 8.5 2.8c0 5.8-8.5 11.3-8.5 11.3Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>`)}
  ${icon('i-heart-fill', `<path d="M12 20.5S3.5 15 3.5 9.2A4.7 4.7 0 0 1 12 6.4a4.7 4.7 0 0 1 8.5 2.8c0 5.8-8.5 11.3-8.5 11.3Z" fill="currentColor"/>`)}
  ${icon('i-link', `<path d="M10 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.2 1.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M14 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.2-1.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`)}
  ${icon('i-qr', `<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M14 14h3v3h-3zM20.5 14v6.5H17M14 20.5h1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`)}
  ${icon('i-ticket', `<path d="M3.5 8.5V6.8c0-.7.6-1.3 1.3-1.3h14.4c.7 0 1.3.6 1.3 1.3v1.7a3.2 3.2 0 0 0 0 6.4v1.7c0 .7-.6 1.3-1.3 1.3H4.8c-.7 0-1.3-.6-1.3-1.3v-1.7a3.2 3.2 0 0 0 0-6.4Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9.5 6v12" stroke="currentColor" stroke-width="1.3" stroke-dasharray="2 3"/><path d="M13.5 9.5h3M13.5 13h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`)}
  ${icon('i-users', `<circle cx="9" cy="8.5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2.8 19.5c.6-3.2 3.1-5.2 6.2-5.2s5.6 2 6.2 5.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M16 5.6a3.2 3.2 0 0 1 0 6M18 14.6c2 .6 3.3 2.3 3.6 4.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`)}
  ${icon('i-user', `<circle cx="12" cy="8" r="3.8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4.5 20c.7-3.7 3.8-6 7.5-6s6.8 2.3 7.5 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`)}
  ${icon('i-plus', `<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`)}
  ${icon('i-minus', `<path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`)}
  ${icon('i-x', `<path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`)}
  ${icon('i-shield', `<path d="M12 21c4.4-1.8 7-5.2 7-9.4V5.6L12 3 5 5.6v6c0 4.2 2.6 7.6 7 9.4Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8.8 11.8l2.2 2.2 4.2-4.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`)}
  ${icon('i-download', `<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 18.5h15" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`)}
  ${icon('i-refresh', `<path d="M20 12a8 8 0 1 1-2.4-5.7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M20 4v4.5h-4.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`)}
  ${icon('i-search', `<circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`)}
  ${icon('i-copy', `<rect x="9" y="9" width="11" height="11" rx="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M15 6.5V5.4C15 4.6 14.4 4 13.6 4H5.4C4.6 4 4 4.6 4 5.4v8.2c0 .8.6 1.4 1.4 1.4h1.1" fill="none" stroke="currentColor" stroke-width="1.6"/>`)}
  ${icon('i-logout', `<path d="M15 4h3.2c.7 0 1.3.6 1.3 1.3v13.4c0 .7-.6 1.3-1.3 1.3H15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M10 8l-4 4 4 4M6 12h8.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`)}
  ${icon('i-chart', `<path d="M4 20V4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M4 20h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M7.5 16V11M12 16V7.5M16.5 16v-3" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`)}
  ${icon('i-mail', `<rect x="3" y="5.5" width="18" height="13" rx="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m4 7.5 8 5.6 8-5.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`)}
  ${icon('i-phone', `<path d="M6.2 3.5h2.1c.5 0 .9.3 1 .8l.8 3c.1.4 0 .8-.4 1l-1.5 1a11.5 11.5 0 0 0 5.4 5.4l1-1.5c.2-.3.6-.5 1-.4l3 .8c.5.1.8.5.8 1v2.1c0 1.2-1 2.1-2.2 2A15.6 15.6 0 0 1 4.2 5.7c-.1-1.2.8-2.2 2-2.2Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>`)}
  ${icon('i-share', `<circle cx="6" cy="12" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="18" cy="6" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="18" cy="18" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" stroke="currentColor" stroke-width="1.5"/>`)}
  ${icon('i-filter', `<path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`)}
  ${icon('i-grid', `<rect x="4" y="4" width="7" height="7" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.6"/>`)}
  ${icon('i-sparkle', `<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9L12 3.5Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M18.5 16.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" fill="currentColor"/>`)}
  ${icon('i-alert', `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 7.5v6M12 16.6v.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`)}
  ${icon('i-info', `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 11v5.5M12 7.6v.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`)}
  ${icon('i-chevron-down', `<path d="m6 9.5 6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`)}
  ${icon('i-chevron-up', `<path d="m6 14.5 6-6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`)}
  ${icon('i-chevron-left', `<path d="M14.5 6 8.5 12l6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`)}
  ${icon('i-chevron-right', `<path d="m9.5 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`)}
  ${icon('i-male', `<circle cx="11" cy="13.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M15.5 9 21 3.5M16.5 3.5H21V8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`)}
  ${icon('i-female', `<circle cx="12" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 14.5V21M8.8 18h6.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`)}
  ${icon('i-clock-fast', `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 7.5V12l3 1.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`)}
  ${icon('i-pen', `<path d="M15.6 4.6 19.4 8.4 8.9 18.9 4.4 20l1.1-4.5L15.6 4.6Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m13.8 6.4 3.8 3.8" stroke="currentColor" stroke-width="1.6"/>`)}
  ${icon('i-trash', `<path d="M5 7h14M9.5 7V4.8c0-.4.4-.8.8-.8h3.4c.4 0 .8.4.8.8V7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M6.5 7l.9 12c0 .6.5 1 1.1 1h7c.6 0 1.1-.4 1.1-1l.9-12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M10.5 11v5M13.5 11v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`)}
  ${icon('i-settings', `<circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M5.9 5.9l1.6 1.6M16.5 16.5l1.6 1.6M18.1 5.9l-1.6 1.6M7.5 16.5l-1.6 1.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`)}
  ${icon('i-machine', `<rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 6.6v1.4M12 16v1.4M6.6 12H8M16 12h1.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`)}
  ${icon('i-facebook', `<path d="M13.5 21v-7.6h2.6l.4-3h-3V8.5c0-.9.3-1.5 1.5-1.5h1.6V4.2c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1v2.2H7.6v3h2.6V21h3.3Z" fill="currentColor"/>`)}
  ${icon('i-instagram', `<rect x="3.8" y="3.8" width="16.4" height="16.4" rx="5" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="17" cy="7" r="1.2" fill="currentColor"/>`)}
  ${icon('i-tiktok', `<path d="M14.2 3.5h2.5c.2 1.7 1.2 3.1 2.8 3.6v2.5a6.6 6.6 0 0 1-2.9-.8v5.4a5.6 5.6 0 1 1-5.6-5.6c.3 0 .5 0 .8.1v2.7a2.9 2.9 0 1 0 2.4 2.8V3.5Z" fill="currentColor"/>`)}
  ${icon('i-flower', `<g fill="none" stroke="currentColor" stroke-width="1"><circle cx="100" cy="100" r="74"/><circle cx="100" cy="100" r="52"/><circle cx="100" cy="100" r="30"/><ellipse cx="100" cy="42" rx="15" ry="34"/><ellipse cx="100" cy="158" rx="15" ry="34"/><ellipse cx="42" cy="100" rx="34" ry="15"/><ellipse cx="158" cy="100" rx="34" ry="15"/><ellipse cx="59" cy="59" rx="15" ry="34" transform="rotate(-45 59 59)"/><ellipse cx="141" cy="141" rx="15" ry="34" transform="rotate(-45 141 141)"/><ellipse cx="141" cy="59" rx="34" ry="15" transform="rotate(45 141 59)"/><ellipse cx="59" cy="141" rx="34" ry="15" transform="rotate(45 59 141)"/><path d="M100 8v184M8 100h184"/></g>`, '0 0 200 200')}
  ${icon('i-portal', `<g fill="none" stroke="currentColor" stroke-width="2"><path d="M6 78V40C6 20 20 6 40 6h20c20 0 34 14 34 34v38"/><path d="M50 78V42c0-11 8-19 19-19s19 8 19 19v36"/><path d="M3 78h94"/><path d="M50 78v14M50 100v14M50 122v14"/><path d="M26 86h48" stroke-dasharray="4 5"/></g>`, '0 0 100 140')}
  ${icon('i-hands', `<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21v-5.5L5.2 12a2 2 0 0 1 2.8-2.8L10 11V4.6a1.6 1.6 0 0 1 3.2 0V10"/><path d="M15 21v-4.6l3.8-3.5a2 2 0 0 0-2.8-2.8L13.2 13"/><path d="M12 21h6"/></g>`)}
</svg>`;

  function inject() {
    if (document.getElementById('sms-sprite')) return;
    const holder = document.createElement('div');
    holder.id = 'sms-sprite';
    holder.setAttribute('aria-hidden', 'true');
    holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    holder.innerHTML = sprite;
    document.body.insertBefore(holder, document.body.firstChild);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();
