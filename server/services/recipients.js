const db = require('../db');

function getAdminUserIds() {
  return db
    .prepare("SELECT id FROM users WHERE role = 'admin' AND active = 1")
    .all()
    .map((r) => r.id);
}

module.exports = { getAdminUserIds };
