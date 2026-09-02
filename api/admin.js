// GET /api/admin?resource=stats|users|kundlis|matching   Header: Authorization: Bearer <admin token>
//
// Consolidated into ONE file. Vercel's Hobby plan caps a deployment at 12
// serverless functions total, and this used to be 4 separate files
// (stats.js, users.js, kundlis.js, matching.js) — that alone pushed the
// project over the limit. Same logic, same security check, just one
// function instead of four.

const { parse } = require('url');
const { query } = require('../lib/db');
const { requireAdmin } = require('../lib/adminAuth');

async function getStats(){
  const [users, kundlis, matches, messages, usersToday, kundlisToday] = await Promise.all([
    query('SELECT COUNT(*) AS count FROM users'),
    query('SELECT COUNT(*) AS count FROM kundlis'),
    query('SELECT COUNT(*) AS count FROM compatibility_reports'),
    query('SELECT COUNT(*) AS count FROM chat_messages'),
    query("SELECT COUNT(*) AS count FROM users WHERE created_at >= date_trunc('day', now())"),
    query("SELECT COUNT(*) AS count FROM kundlis WHERE created_at >= date_trunc('day', now())"),
  ]);
  const n = (r) => parseInt(r.rows[0].count, 10) || 0;
  return {
    totalUsers: n(users), totalKundlis: n(kundlis), totalCompatibilityReports: n(matches),
    totalChatMessages: n(messages), newUsersToday: n(usersToday), kundlisToday: n(kundlisToday),
  };
}

async function getUsers(){
  const result = await query(`SELECT id, name, email, plan, is_admin, created_at FROM users ORDER BY created_at DESC LIMIT 500`);
  return { users: result.rows.map(u => ({ id: u.id, name: u.name, email: u.email, plan: u.plan, isAdmin: u.is_admin, createdAt: u.created_at })) };
}

async function getKundlis(){
  const result = await query(
    `SELECT k.id, k.name, k.dob::text AS dob, k.tob::text AS tob, k.pob, k.created_at,
            u.name AS owner_name, u.email AS owner_email
     FROM kundlis k JOIN users u ON u.id = k.user_id ORDER BY k.created_at DESC LIMIT 500`
  );
  return { kundlis: result.rows.map(k => ({
    id: k.id, ownerName: k.owner_name, ownerEmail: k.owner_email,
    name: k.name, dob: k.dob, tob: k.tob, pob: k.pob, createdAt: k.created_at,
  })) };
}

async function getMatchingReports(){
  const result = await query(
    `SELECT c.id, c.person1_name, c.person2_name, c.result, c.created_at,
            u.name AS owner_name, u.email AS owner_email
     FROM compatibility_reports c JOIN users u ON u.id = c.user_id ORDER BY c.created_at DESC LIMIT 500`
  );
  return { reports: result.rows.map(r => ({
    id: r.id, ownerName: r.owner_name, ownerEmail: r.owner_email,
    person1Name: r.person1_name, person2Name: r.person2_name,
    totalPoints: r.result && r.result.result ? r.result.result.total : null,
    verdict: r.result && r.result.result ? r.result.result.verdict : null,
    createdAt: r.created_at,
  })) };
}

const RESOURCE_HANDLERS = { stats: getStats, users: getUsers, kundlis: getKundlis, matching: getMatchingReports };

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = await requireAdmin(req);
  if (!admin) return res.status(403).json({ error: 'Admin access required.' });

  const { query: urlQuery } = parse(req.url, true);
  const handler = RESOURCE_HANDLERS[urlQuery.resource];
  if (!handler) return res.status(400).json({ error: 'Unknown or missing resource parameter.' });

  try {
    return res.status(200).json(await handler());
  } catch (err) {
    console.error('admin endpoint error:', err);
    return res.status(500).json({ error: 'Could not load admin data.' });
  }
};
