// Shared admin-only authorization check. Returns { userId } if the request
// carries a valid session AND that user has is_admin = true in the database
// (never trusts anything from the client about admin status). Returns null
// otherwise — callers should respond 403 in that case.

const { query } = require('./db');
const { verifyToken } = require('./auth');

async function requireAdmin(req){
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !process.env.AUTH_SECRET) return null;

  const payload = verifyToken(token, process.env.AUTH_SECRET);
  if (!payload || !payload.userId) return null;

  try {
    const result = await query('SELECT id, is_admin FROM users WHERE id = $1', [payload.userId]);
    const user = result.rows[0];
    if (!user || !user.is_admin) return null;
    return { userId: user.id };
  } catch (err) {
    console.error('requireAdmin check failed:', err);
    return null; // fail closed — any error means "not confirmed admin"
  }
}

module.exports = { requireAdmin };
