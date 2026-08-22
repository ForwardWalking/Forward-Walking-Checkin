import { getStore } from '@netlify/blobs';
import webpush from 'web-push';

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

export const config = { path: '/test-push' };

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) {
    return json({ error: 'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set in Netlify environment variables' }, 500);
  }

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
  if (!user.pushSubscription) return json({ error: 'This user has not enabled push notifications yet' }, 400);

  webpush.setVapidDetails('mailto:hello@forwardwalking.org', vapidPublic, vapidPrivate);

  try {
    await webpush.sendNotification(
      user.pushSubscription,
      JSON.stringify({
        title: 'Test notification',
        body: `Hey ${user.name} — this is a test. If you see this, push notifications are working.`,
      })
    );
    return json({ ok: true, message: 'Push sent' });
  } catch (err) {
    return json({ error: 'Failed to send push', detail: String(err) }, 500);
  }
};
