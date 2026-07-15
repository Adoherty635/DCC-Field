const path = require('path');
require('dotenv').config();

const root = path.join(__dirname, '..');

module.exports = {
  port: process.env.PORT || 3000,
  dbPath: process.env.DATABASE_PATH
    ? path.resolve(root, process.env.DATABASE_PATH)
    : path.join(root, 'data', 'app.db'),
  uploadsPath: process.env.UPLOADS_PATH
    ? path.resolve(root, process.env.UPLOADS_PATH)
    : path.join(root, 'data', 'uploads'),
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    fromNumber: process.env.TWILIO_FROM_NUMBER || '',
    get configured() {
      return Boolean(
        process.env.TWILIO_ACCOUNT_SID &&
          process.env.TWILIO_AUTH_TOKEN &&
          process.env.TWILIO_FROM_NUMBER
      );
    },
  },
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  get anthropicConfigured() {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  },
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  isProduction: process.env.NODE_ENV === 'production',
};
