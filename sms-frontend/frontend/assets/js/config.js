window.SMS_CONFIG = {
 /*FastAPI backend URL */
 API_BASE_URL:'https://sms-reg-api.onrender.com',
 /*use the live backend,not the mock data */
 USE_MOCK_API: false,
  /* Live API version prefix — matches the backend router. */
  API_PREFIX: '/api/v1',

  /* Where successful registrations land. The backend returns an
     absolute invite URL; this is the frontend fallback. */
  APP_URL: 'https://sms-summit-2026.onrender.com',

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

  /* Demo accounts are removed for production.
     Organizer accounts are created through the backend API only. */
  DEMO_ACCOUNTS: []
};

/* ?demo=0 / ?demo=1 override, handy for QA */
(function () {
  const q = new URLSearchParams(location.search).get('demo');
  if (q === '0') window.SMS_CONFIG.USE_MOCK_API = false;
  if (q === '1') window.SMS_CONFIG.USE_MOCK_API = true;
})();
