import { getStore } from '@netlify/blobs';

export const config = { path: '/save-reminder' };

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

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { id, reminderHour, reminderMinute, timezone } = body;
  if (!id) return json({ error: 'id is required' }, 400);

  const store = getStore('users');
  const user = await store.get(id, { type: 'json' });
  if (!user) return json({ error: 'User not found' }, 404);

  if (Number.isInteger(reminderHour) && reminderHour >= 0 && reminderHour <= 23) {
    user.reminderHour = reminderHour;
  }
  if (Number.isInteger(reminderMinute) && reminderMinute >= 0 && reminderMinute <= 59) {
    user.reminderMinute = reminderMinute;
  }
  if (typeof timezone === 'string' && timezone.length < 64) user.timezone = timezone;
  user.reminderSetAt = new Date().toISOString();

  await store.setJSON(id, user);
  return json({ ok: true });
};
