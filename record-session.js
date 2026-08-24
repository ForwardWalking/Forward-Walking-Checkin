import { getStore } from '@netlify/blobs';

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

function getWeekStart(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = dt.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  dt.setUTCDate(dt.getUTCDate() + diffToMonday);
  return dt.toISOString().slice(0, 10);
}

function updateStreak(user, dateStr) {
  const yesterday = addDays(dateStr, -1);
  user.streak.current = user.streak.lastCheckinDate === yesterday ? (user.streak.current || 0) + 1 : 1;
  user.streak.lastCheckinDate = dateStr;
  user.streak.best = Math.max(user.streak.best || 0, user.streak.current);
}

export const config = { path: '/record-session' };

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { uid, protocol, difficulty, durationSec, avgReward, gatesPassed, bestStreak, rating, timestamp } = body;
  if (!uid) return json({ error: 'uid is required' }, 400);

  const store = getStore('users');
  const user = await store.get(uid, { type: 'json' });
  if (!user) return json({ error: 'User not found' }, 404);

  const dateStr = getLocalDateStr(user.timezone || 'America/Phoenix');
  const isNewCheckinToday = !user.checkins[dateStr];

  user.checkins[dateStr] = {
    type: 'training',
    protocol, difficulty, durationSec, avgReward, gatesPassed, bestStreak,
    rating: Number.isInteger(rating) ? rating : null,
    reportedAt: timestamp || new Date().toISOString(),
  };

  const weekStart = getWeekStart(dateStr);
  if (user.weekStartDate !== weekStart) {
    user.weekStartDate = weekStart;
    user.weeklyTrainingCount = 0;
  }
  user.weeklyTrainingCount = (user.weeklyTrainingCount || 0) + 1;

  if (isNewCheckinToday) updateStreak(user, dateStr);

  await store.setJSON(uid, user);
  return json({ ok: true, streak: user.streak, weeklyTrainingCount: user.weeklyTrainingCount });
};
