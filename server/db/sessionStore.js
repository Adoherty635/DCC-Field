const session = require('express-session');
const db = require('./index');

class SqliteSessionStore extends session.Store {
  constructor() {
    super();
    this.getStmt = db.prepare('SELECT sess, expires FROM sessions WHERE sid = ?');
    this.setStmt = db.prepare(
      `INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?)
       ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires`
    );
    this.destroyStmt = db.prepare('DELETE FROM sessions WHERE sid = ?');
    this.touchStmt = db.prepare('UPDATE sessions SET expires = ? WHERE sid = ?');

    // Periodically sweep expired sessions. This runs on a bare timer with
    // no request/response around it, so an uncaught error here would crash
    // the whole process instead of just failing one HTTP request.
    this._sweepInterval = setInterval(() => {
      try {
        db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
      } catch (err) {
        console.error('[sessionStore] sweep failed:', err.message);
      }
    }, 60 * 60 * 1000).unref();
  }

  get(sid, cb) {
    try {
      const row = this.getStmt.get(sid);
      if (!row) return cb(null, null);
      if (row.expires < Date.now()) {
        this.destroyStmt.run(sid);
        return cb(null, null);
      }
      cb(null, JSON.parse(row.sess));
    } catch (err) {
      cb(err);
    }
  }

  set(sid, sessionData, cb) {
    try {
      const maxAge = sessionData.cookie && sessionData.cookie.maxAge
        ? sessionData.cookie.maxAge
        : 24 * 60 * 60 * 1000;
      const expires = Date.now() + maxAge;
      this.setStmt.run(sid, JSON.stringify(sessionData), expires);
      cb && cb(null);
    } catch (err) {
      cb && cb(err);
    }
  }

  destroy(sid, cb) {
    try {
      this.destroyStmt.run(sid);
      cb && cb(null);
    } catch (err) {
      cb && cb(err);
    }
  }

  touch(sid, sessionData, cb) {
    try {
      const maxAge = sessionData.cookie && sessionData.cookie.maxAge
        ? sessionData.cookie.maxAge
        : 24 * 60 * 60 * 1000;
      this.touchStmt.run(Date.now() + maxAge, sid);
      cb && cb(null);
    } catch (err) {
      cb && cb(err);
    }
  }

  // Invalidates every session belonging to a given userId (e.g. on password reset).
  invalidateUser(userId) {
    const rows = db.prepare('SELECT sid, sess FROM sessions').all();
    const destroy = db.prepare('DELETE FROM sessions WHERE sid = ?');
    for (const row of rows) {
      try {
        const data = JSON.parse(row.sess);
        if (data.userId === userId) destroy.run(row.sid);
      } catch {
        // corrupt row, ignore
      }
    }
  }
}

module.exports = new SqliteSessionStore();
