const db = require('../db');
const config = require('../config');
const { sendSms } = require('./sms');

const DEBOUNCE_MS = 10 * 60 * 1000; // ~10 minutes
const debounceMap = new Map();

function insertNotification(recipientUserId, category, text, projectId) {
  const info = db
    .prepare(
      `INSERT INTO notifications (user_id, body, category, project_id) VALUES (?, ?, ?, ?)`
    )
    .run(recipientUserId, text, category, projectId || null);
  return info.lastInsertRowid;
}

function markSmsSent(notificationId) {
  db.prepare('UPDATE notifications SET sms_sent = 1 WHERE id = ?').run(notificationId);
}

// Returns the recipient user if SMS should be attempted, else null.
function smsEligibleUser(recipientUserId, category) {
  if (!config.twilio.configured) return null;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(recipientUserId);
  if (!user || !user.phone || !user.active) return null;
  const pref = db
    .prepare('SELECT enabled FROM alert_prefs WHERE user_id = ? AND category = ?')
    .get(recipientUserId, category);
  if (!pref || !pref.enabled) return null;
  return user;
}

// Step 1: always insert a feed row. Step 2: SMS if eligible. Never throws.
async function notify(recipientUserId, category, text, projectId) {
  const notificationId = insertNotification(recipientUserId, category, text, projectId);

  const user = smsEligibleUser(recipientUserId, category);
  if (!user) return;

  try {
    const link = `${config.appUrl}/p/${projectId}`;
    const sent = await sendSms(user.phone, `DCC Field: ${text} ${link}`);
    if (sent) markSmsSent(notificationId);
  } catch (err) {
    console.error('[notify] sms failed:', err.message);
  }
}

// Collapses repeated uploads by the same actor to the same project/category
// within a ~10 minute window into a single SMS ("added 5 photos").
function notifyBatched(recipientUserId, category, projectId, actorLabel, itemLabel) {
  const notificationId = insertNotification(
    recipientUserId,
    category,
    `${actorLabel} added a ${itemLabel}`,
    projectId
  );

  const key = [recipientUserId, category, projectId, actorLabel].join(':');
  let entry = debounceMap.get(key);
  if (!entry) {
    entry = { count: 0, timer: null, lastNotificationId: null };
    debounceMap.set(key, entry);
  }
  entry.count += 1;
  entry.lastNotificationId = notificationId;

  if (entry.timer) clearTimeout(entry.timer);
  entry.timer = setTimeout(async () => {
    // Runs detached from any request minutes later — an uncaught error or
    // rejection here crashes the whole process (Node's default for
    // unhandled rejections), so everything is wrapped, not just the SMS call.
    try {
      debounceMap.delete(key);
      const user = smsEligibleUser(recipientUserId, category);
      if (!user) return;
      const plural = entry.count === 1 ? itemLabel : `${itemLabel}s`;
      const text = `${actorLabel} added ${entry.count} ${plural}`;
      const link = `${config.appUrl}/p/${projectId}`;
      const sent = await sendSms(user.phone, `DCC Field: ${text} ${link}`);
      if (sent) markSmsSent(entry.lastNotificationId);
    } catch (err) {
      console.error('[notify] batched sms failed:', err.message);
    }
  }, DEBOUNCE_MS);
}

module.exports = { notify, notifyBatched };
