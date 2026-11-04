/* ============================================================
   SMS SUMMIT 2026 — Frontend configuration
   The only file you need to touch when the backend comes online.
   ============================================================ */
window.SMS_CONFIG = {
  /* Base URL of the FastAPI backend.
     ''  → same origin (use this if you proxy /api through the dev server)
     e.g. 'http://localhost:8000' during local integration
     e.g. 'https://api.smssummit26.com' in production           */
  API_BASE_URL: '',

  /* When true, all API calls are answered by an in-browser mock
     (assets/js/mock-api.js) that mirrors the FastAPI contract and
     persists to localStorage. Flip to false once the backend is up. */
  USE_MOCK_API: true,

  /* Live API version prefix — matches the backend router. */
  API_PREFIX: '/api/v1',

  /* Where successful registrations land. The backend returns an
     absolute invite URL; this is the frontend fallback. */
  APP_URL: '',

  EVENT: {
    name: 'Singles & Married Summit',
    edition: '2026',
    theme: 'The Marital Blueprint',
    host: 'The Potters Tribe',
    partner: 'True Worshippers Assembly',
    dateISO: '2026-11-15T16:00:00+01:00', // 4PM WAT (UTC+1)
    dateLabel: '15th November 2026',
    timeLabel: '4PM WAT',
    venue: 'Top Floor, Elyon Primary School',
    address: '10 Ichiegbo Street, Off Psychiatric Road, Rumuorosi',
    city: 'Port Harcourt, Rivers State',
    socials: {
      facebook: 'https://facebook.com/thepotterstribe',
      instagram: 'https://instagram.com/thepotterstribe',
      tiktok: 'https://tiktok.com/@thepotterstribe'
    }
  },

  /* Organizer demo accounts (mock mode only). */
  DEMO_ACCOUNTS: [
    { email: 'admin@smssummit.org', password: 'Summit2026!', role: 'admin', name: 'Precious A.' },
    { email: 'desk@smssummit.org', password: 'Desk2026!', role: 'organizer', name: 'Desk Team' }
  ]
};

/* ?demo=0 / ?demo=1 override, handy for QA */
(function () {
  const q = new URLSearchParams(location.search).get('demo');
  if (q === '0') window.SMS_CONFIG.USE_MOCK_API = false;
  if (q === '1') window.SMS_CONFIG.USE_MOCK_API = true;
})();
