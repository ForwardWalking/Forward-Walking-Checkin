import { getStore } from '@netlify/blobs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

export const config = { path: '/get-user' };

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return json({ error: 'id is required' }, 400);

  const store = getStore('users');
  const user = await store.get(id, { type: 'json' });
  if (!user) return json({ error: 'User not found' }, 404);

  const dateStr = getLocalDateStr(user.timezone || 'America/Phoenix');
  const todayCheckin = user.checkins?.[dateStr] || null;

  return json({
    name: user.name,
    streak: user.streak,
    weeklyTrainingCount: user.weeklyTrainingCount || 0,
    checkedInToday: !!todayCheckin,
    checkinTypeToday: todayCheckin?.type || null,
    reminderHour: user.reminderHour,
    reminderMinute: user.reminderMinute,
    reminderIsSet: !!user.reminderSetAt,
  });
};
