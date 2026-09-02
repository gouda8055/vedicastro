// Minimal Resend email sender.
//
// HONESTY NOTE: sending FROM 'onboarding@resend.dev' works out of the box
// with no setup, but Resend restricts it — reliably deliverable mainly to
// the email address you signed up to Resend with. To actually email your
// real users, verify your own domain in the Resend dashboard and change
// FROM_ADDRESS below to something like 'noreply@yourdomain.com'.

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_ADDRESS = process.env.EMAIL_FROM || 'VedicAstro <onboarding@resend.dev>';

async function sendEmail({ to, subject, html }){
  if (!process.env.PASSWORD_KEY) {
    throw new Error('PASSWORD_KEY is not set — cannot send email.');
  }
  const resp = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.PASSWORD_KEY}`,
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(data.message || 'Failed to send email');
    err.details = data;
    throw err;
  }
  return data;
}

module.exports = { sendEmail };
