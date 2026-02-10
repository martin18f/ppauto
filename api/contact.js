const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

function norm(s) {
  return String(s || '').trim();
}

function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const { meno, email, telefon, sprava, website } = req.body || {};

    // honeypot: ak bot vyplní hidden pole, tvárime sa OK a nič neposielame
    if (norm(website)) return res.status(200).json({ ok: true });

    const name = norm(meno);
    const fromEmail = norm(email);
    const phone = norm(telefon);
    const message = norm(sprava);

    // minimálna validácia
    if (!name || !fromEmail || !message) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }
    if (!isEmail(fromEmail)) {
      return res.status(400).json({ ok: false, error: 'Invalid email' });
    }

    const to = process.env.CONTACT_TO;          // ✅ sem dáš svoj mail cez ENV
    const from = process.env.CONTACT_FROM;      // napr. "PP AUTO <noreply@ppauto.sk>"

    if (!to) return res.status(500).json({ ok: false, error: 'CONTACT_TO not set' });
    if (!from) return res.status(500).json({ ok: false, error: 'CONTACT_FROM not set' });

    const subject = `PP AUTO – nová správa z webu (${name})`;

    const text =
`Meno: ${name}
Email: ${fromEmail}
Telefón: ${phone || '-'}
---
Správa:
${message}
`;

    await resend.emails.send({
      from,
      to,
      reply_to: fromEmail,
      subject,
      text
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('CONTACT API error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
};
