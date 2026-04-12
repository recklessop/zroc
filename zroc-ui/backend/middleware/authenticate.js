// backend/middleware/authenticate.js
'use strict';

/**
 * Middleware: require an authenticated session.
 * If the request has no valid session → 401.
 * Attaches req.user = { id, username, name, email, role } for downstream use.
 */
function authenticate(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Unauthorized', code: 'NO_SESSION' });
  }
  req.user = req.session.user;
  next();
}

/**
 * Middleware: require admin role.
 * Must be used AFTER authenticate().
 */
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden', code: 'REQUIRES_ADMIN' });
  }
  next();
}

module.exports = { authenticate, requireAdmin };
