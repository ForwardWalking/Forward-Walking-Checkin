import { getStore } from '@netlify/blobs';
import { randomUUID } from 'node:crypto';

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

export const config = { path: '/register' };

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const name = (body.name || '').trim().slice(0, 60);
  if (!name) return json({ error: 'Name is required' }, 400);

  const timezone = typeof body.timezone === 'string' && body.timezone.length < 64
    ? body.timezone
    : 'America/Phoenix';

  const id = 'uid_' + randomUUID().replace(/-/g, '').slice(0, 20);

  const user = {
    id,
    name,
    createdAt: new Date().toISOString(),
    timezone,
    reminderHour: 18,
    reminderMinute: 0,
    // checkins keyed by local "YYYY-MM-DD": { type: 'training'|'offday', ...details }
    checkins: {},
    weeklyTrainingCount: 0,
    weekStartDate: null,
    streak: { current: 0, best: 0, lastCheckinDate: null },
  };

  const store = getStore('users');
  await store.setJSON(id, user);

  return json({ id, name });
};
