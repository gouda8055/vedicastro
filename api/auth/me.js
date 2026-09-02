// GET /api/auth/me   Header: Authorization: Bearer <token>
// -> 200 { user: { id, name, email, plan } }  or  401 if missing/invalid/expired

const { query } = require('../../lib/db');
const { verifyToken } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !process.env.AUTH_SECRET) {
    return res.status(401).json({ error: 'Not signed in.' });
  }

  const payload = verifyToken(token, process.env.AUTH_SECRET);
  if (!payload || !payload.userId) {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }

  try {
    const result = await query('SELECT id, name, email, plan, is_admin FROM users WHERE id = $1', [payload.userId]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Account no longer exists.' });
    }
    return res.status(200).json({ user });
  } catch (err) {
    console.error('me error:', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
};
