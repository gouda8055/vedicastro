// POST /api/auth/password   { action: 'forgot', email }
// POST /api/auth/password   { action: 'reset', token, newPassword }
//
// Consolidated into ONE file (not two) — Vercel's Hobby plan caps a
// deployment at 12 serverless functions, and this project is already at
// that ceiling. Same security properties either way:
//   - reset tokens are high-entropy random values, only their HASH is ever
//     stored (like passwords) — a stolen database can't be used to forge
//     working reset links
//   - the forgot-password step always returns the same generic message
//     whether or not the email exists, so this can't be used to discover
//     which emails have accounts
//   - tokens expire after 1 hour and are single-use (cleared on success)

const crypto = require('crypto');
const { query } = require('../../lib/db');
const { hashPassword } = require('../../lib/auth');
const { sendEmail } = require('../../lib/email');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const GENERIC_FORGOT_MESSAGE = "If an account exists for that email, we've sent a password reset link.";

function hashToken(token){
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function handleForgot(req, res){
  const { email } = req.body || {};
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    const result = await query('SELECT id, name FROM users WHERE email = $1', [normalizedEmail]);
    const user = result.rows[0];

    // Always respond the same way whether or not the account exists — this
    // is deliberate, not a bug: it stops someone from using this endpoint
    // to check which emails are registered.
    if (!user) {
      return res.status(200).json({ message: GENERIC_FORGOT_MESSAGE });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await query('UPDATE users SET reset_token_hash = $1, reset_token_expires = $2 WHERE id = $3', [tokenHash, expiresAt, user.id]);

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const resetLink = `${origin}/reset-password.html?token=${rawToken}`;

    try {
      await sendEmail({
        to: normalizedEmail,
        subject: 'Reset your VedicAstro password',
        html: `<p>Hi ${user.name || ''},</p>
               <p>Someone requested a password reset for your VedicAstro account. Click below to set a new password — this link expires in 1 hour.</p>
               <p><a href="${resetLink}">${resetLink}</a></p>
               <p>If you didn't request this, you can safely ignore this email.</p>`,
      });
    } catch (emailErr) {
      console.error('forgot-password: failed to send email:', emailErr);
      // Don't reveal the failure to the client — same generic response either way.
    }

    return res.status(200).json({ message: GENERIC_FORGOT_MESSAGE });
  } catch (err) {
    console.error('forgot-password error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

async function handleReset(req, res){
  const { token, newPassword } = req.body || {};
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing reset token.' });
  }
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    const tokenHash = hashToken(token);
    const result = await query(
      'SELECT id FROM users WHERE reset_token_hash = $1 AND reset_token_expires > now()',
      [tokenHash]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
    }

    const passwordHash = hashPassword(newPassword);
    await query(
      'UPDATE users SET password_hash = $1, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = $2',
      [passwordHash, user.id]
    );

    return res.status(200).json({ message: 'Your password has been reset. You can now sign in.' });
  } catch (err) {
    console.error('reset-password error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.body || {};
  if (action === 'forgot') return handleForgot(req, res);
  if (action === 'reset') return handleReset(req, res);
  return res.status(400).json({ error: 'Unknown action.' });
};
