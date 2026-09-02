// GET /api/health — confirms the serverless functions are deployed and running.
// Deliberately has zero dependencies, so if this fails, the problem is Vercel
// config, not your code.

module.exports = (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'vedicastro-api',
    time: new Date().toISOString(),
  });
};
