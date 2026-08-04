const bcrypt = require('bcrypt');
const db = require('../db');
const sessionStore = require('../db/sessionStore');

const BCRYPT_COST = 12;

// Usage: node server/scripts/reset-password.js <username> <newPassword> [<username2> <newPassword2> ...]
function resetPasswords(pairs) {
  for (const [username, password] of pairs) {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      console.error(`No user found with username "${username}" — skipped.`);
      continue;
    }
    const password_hash = bcrypt.hashSync(password, BCRYPT_COST);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, user.id);
    sessionStore.invalidateUser(user.id);
    console.log(`Password reset for "${username}" (role: ${user.role}).`);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.length % 2 !== 0) {
    console.error('Usage: node server/scripts/reset-password.js <username> <newPassword> [<username2> <newPassword2> ...]');
    process.exit(1);
  }
  const pairs = [];
  for (let i = 0; i < args.length; i += 2) {
    pairs.push([args[i], args[i + 1]]);
  }
  resetPasswords(pairs);
}

module.exports = resetPasswords;
