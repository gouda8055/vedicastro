// POST /api/auth/signup  { name, email, password }
// -> 201 { token, user: { id, name, email, plan } }

const { query } = require('../../lib/db');
const { hashPassword, signToken } = require('../../lib/auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, password } = req.body || {};

  if (!name || typeof name !== 'string' || name.trim().length < 1) {
    return res.status(400).json({ error: 'Full name is required.' });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (!process.env.AUTH_SECRET) {
    return res.status(500).json({ error: 'Server misconfigured: AUTH_SECRET is not set.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const existing = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    const passwordHash = hashPassword(password);
    const result = await query(
      `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
       RETURNING id, name, email, plan, created_at`,
      [name.trim(), normalizedEmail, passwordHash]
    );
    const user = result.rows[0];

    const token = signToken({ userId: user.id, email: user.email }, process.env.AUTH_SECRET);

    return res.status(201).json({ token, user });
  } catch (err) {
    console.error('signup error:', err);
    return res.status(500).json({ error: 'Something went wrong creating your account. Please try again.' });
  }
};
