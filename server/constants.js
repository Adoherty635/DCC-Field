const ALERT_CATEGORIES = [
  'schedule', 'project', 'scope', 'color', 'order', 'photo', 'note', 'receipt',
];

const DEFAULT_ALERT_PREFS = {
  crew: ['schedule', 'project', 'scope', 'color', 'order'],
  admin: ['photo', 'note', 'order', 'receipt'],
};

function defaultPrefsFor(role) {
  const on = new Set(DEFAULT_ALERT_PREFS[role] || []);
  return ALERT_CATEGORIES.map((category) => ({
    category,
    enabled: on.has(category) ? 1 : 0,
  }));
}

module.exports = { ALERT_CATEGORIES, DEFAULT_ALERT_PREFS, defaultPrefsFor };
