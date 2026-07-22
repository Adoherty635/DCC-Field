const db = require('../db');

// Scheduled projects whose start date has arrived flip to "In progress" on
// their own — Complete stays a deliberate admin action (it already has a
// confirm gate on the Projects list), so only this one transition is automatic.
function advanceScheduledProjects() {
  db.prepare(
    `UPDATE projects SET status = 'In progress'
     WHERE status = 'Scheduled' AND start_date IS NOT NULL AND start_date <= date('now')`
  ).run();
}

module.exports = { advanceScheduledProjects };
