const path = require('path');
const express = require('express');
const session = require('express-session');
const config = require('./config');
require('./db'); // ensures schema is created before anything else touches it
const sessionStore = require('./db/sessionStore');
const seed = require('./scripts/seed'); // no-ops once users already exist

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const colorRoutes = require('./routes/colors');
const orderRoutes = require('./routes/orders');
const noteRoutes = require('./routes/notes');
const photoRoutes = require('./routes/photos');
const mediaRoutes = require('./routes/media');
const eventRoutes = require('./routes/events');
const teamRoutes = require('./routes/team');
const notificationRoutes = require('./routes/notifications');

const app = express();
app.set('trust proxy', 1);

app.use(express.json({ limit: '2mb' }));

app.use(
  session({
    store: sessionStore,
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects/:projectId/colors', colorRoutes);
app.use('/api/projects/:projectId/orders', orderRoutes);
app.use('/api/projects/:projectId/notes', noteRoutes);
app.use('/api/projects/:projectId/photos', photoRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/notifications', notificationRoutes);

// Multer / body errors surface here instead of crashing the process.
app.use('/api', (err, req, res, next) => {
  console.error('[api error]', err.message);
  res.status(400).json({ error: err.message || 'Request failed' });
});

const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

seed();

app.listen(config.port, () => {
  console.log(`DCC Field listening on port ${config.port}`);
  if (!config.twilio.configured) console.log('  Twilio not configured — SMS disabled.');
  if (!config.anthropicConfigured) console.log('  Anthropic not configured — translation disabled.');
});
