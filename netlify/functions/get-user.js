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

export const config = { path: '/get-user' };

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return json({ error: 'id is required' }, 400);

  const store = getStore('users');
  const user = await store.get(id, { type: 'json' });
  if (!user) return json({ error: 'User not found' }, 404);

  return json({
    name: user.name,
    streak: user.streak,
    weeklyTrainingCount: user.weeklyTrainingCount || 0,
  });
};
