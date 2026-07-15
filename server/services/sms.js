const config = require('../config');

let client = null;
if (config.twilio.configured) {
  const twilio = require('twilio');
  client = twilio(config.twilio.accountSid, config.twilio.authToken);
}

// Returns true if a text was actually sent.
async function sendSms(toPhone, body) {
  if (!config.twilio.configured || !client || !toPhone) return false;
  try {
    await client.messages.create({
      to: toPhone,
      from: config.twilio.fromNumber,
      body,
    });
    return true;
  } catch (err) {
    console.error('[sms] send failed:', err.message);
    return false;
  }
}

module.exports = { sendSms };
