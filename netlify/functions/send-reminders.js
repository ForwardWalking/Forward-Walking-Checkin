import { getStore } from '@netlify/blobs';
import webpush from 'web-push';

export const config = { schedule: '0 * * * *' }; // top of every hour, UTC

function getLocalParts(timezone) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  return {
    dateStr: `${map.year}-${map.month}-${map.day}`,
    hour: parseInt(map.hour, 10),
    minute: parseInt(map.minute, 10),
  };
}

export default async () => {
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) {
    console.error('VAPID keys not configured — skipping reminder run.');
    return new Response('VAPID keys not configured', { status: 500 });
  }
  webpush.setVapidDetails('mailto:hello@forwardwalking.org', vapidPublic, vapidPrivate);

  const store = getStore('users');
  const { blobs } = await store.list();

  let checked = 0, sent = 0, skipped = 0, errors = 0;

  for (const { key } of blobs) {
    checked++;
    let user;
    try {
      user = await store.get(key, { type: 'json' });
    } catch {
      errors++;
      continue;
    }
    if (!user || !user.pushSubscription) { skipped++; continue; }

    let local;
    try {
      local = getLocalParts(user.timezone || 'America/Phoenix');
    } catch {
      local = getLocalParts('America/Phoenix');
    }

    const alreadyCheckedInToday = !!user.checkins?.[local.dateStr];
    const alreadyRemindedToday = user.lastReminderSentDate === local.dateStr;
    const pastReminderTime =
      local.hour > user.reminderHour ||
      (local.hour === user.reminderHour && local.minute >= user.reminderMinute);

    if (alreadyCheckedInToday || alreadyRemindedToday || !pastReminderTime) {
      skipped++;
      continue;
    }

    try {
      await webpush.sendNotification(
        user.pushSubscription,
        JSON.stringify({
          title: "Haven't checked in yet today",
          body: `Hey ${user.name} — a quick training session or today's thought keeps your streak alive.`,
        })
      );
      user.lastReminderSentDate = local.dateStr;
      await store.setJSON(key, user);
      sent++;
    } catch (err) {
      console.error(`Push failed for ${key}:`, err);
      errors++;
    }
  }

  console.log(`Reminder run: checked=${checked} sent=${sent} skipped=${skipped} errors=${errors}`);
  return new Response(JSON.stringify({ checked, sent, skipped, errors }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
