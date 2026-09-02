// POST /api/auth/login  { email, password }
// -> 200 { token, user: { id, name, email, plan } }

const { query } = require('../../lib/db');
const { verifyPassword, signToken } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  if (!process.env.AUTH_SECRET) {
    return res.status(500).json({ error: 'Server misconfigured: AUTH_SECRET is not set.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    const result = await query(
      'SELECT id, name, email, plan, password_hash FROM users WHERE email = $1',
      [normalizedEmail]
    );
    const user = result.rows[0];

    // Same error for "no such user" and "wrong password" — don't leak which one it was.
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    const token = signToken({ userId: user.id, email: user.email }, process.env.AUTH_SECRET);
    delete user.password_hash;

    return res.status(200).json({ token, user });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: 'Something went wrong signing you in. Please try again.' });
  }
};
