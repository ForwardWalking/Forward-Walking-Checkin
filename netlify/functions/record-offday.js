import { getStore } from '@netlify/blobs';

export const config = { path: '/record-offday' };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function getLocalDateStr(timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  return `${map.year}-${map.month}-${map.day}`;
}

function addDays(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function updateStreak(user, dateStr) {
  const yesterday = addDays(dateStr, -1);
  user.streak.current = user.streak.lastCheckinDate === yesterday ? (user.streak.current || 0) + 1 : 1;
  user.streak.lastCheckinDate = dateStr;
  user.streak.best = Math.max(user.streak.best || 0, user.streak.current);
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { id } = body;
  if (!id) return json({ error: 'id is required' }, 400);

  const store = getStore('users');
  const user = await store.get(id, { type: 'json' });
  if (!user) return json({ error: 'User not found' }, 404);

  const dateStr = getLocalDateStr(user.timezone || 'America/Phoenix');
  const isNewCheckinToday = !user.checkins[dateStr];

  user.checkins[dateStr] = {
    type: 'offday',
    reportedAt: new Date().toISOString(),
  };

  if (isNewCheckinToday) updateStreak(user, dateStr);

  await store.setJSON(id, user);
  return json({ ok: true, streak: user.streak });
};
