function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
}

// A project belongs to req.params.projectId (or req.body/query) — crew may
// only touch their own crew's project; admin may touch any.
function requireProjectAccess(db) {
  return (req, res, next) => {
    const projectId = req.params.projectId || req.params.id || req.body.project_id || req.query.project_id;
    if (!projectId) return res.status(400).json({ error: 'Missing project id' });
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (req.session.role !== 'admin' && project.crew_id !== req.session.userId) {
      return res.status(403).json({ error: 'Not your project' });
    }
    req.project = project;
    next();
  };
}

module.exports = { requireAuth, requireAdmin, requireProjectAccess };
