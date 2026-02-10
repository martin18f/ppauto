import { Resend } from 'resend';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }

    const { RESEND_API_KEY, CONTACT_TO_EMAIL, CONTACT_FROM_EMAIL } = process.env;

    if (!RESEND_API_KEY) {
      return res.status(500).json({ ok: false, error: 'Missing env: RESEND_API_KEY' });
    }
    if (!CONTACT_TO_EMAIL) {
      return res.status(500).json({ ok: false, error: 'Missing env: CONTACT_TO_EMAIL' });
    }

    const { meno, email, telefon, sprava, website } = req.body || {};

    // honeypot
    if (website) {
      return res.status(200).json({ ok: true });
    }

    if (!meno || !email || !sprava) {
      return res.status(400).json({ ok: false, error: 'Chýbajú povinné polia.' });
    }

    const resend = new Resend(RESEND_API_KEY);

    // Ak nemáš overenú doménu v Resend, dočasne použi onboarding@resend.dev
    const from = CONTACT_FROM_EMAIL || 'PP AUTO <onboarding@resend.dev>';

    const { data, error } = await resend.emails.send({
      from,
      to: [CONTACT_TO_EMAIL],
      replyTo: email,
      subject: `PP AUTO – Kontakt: ${meno}`,
      text: [
        `Meno: ${meno}`,
        `E-mail: ${email}`,
        `Telefón: ${telefon || '-'}`,
        '',
        'Správa:',
        String(sprava)
      ].join('\n')
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(502).json({ ok: false, error: 'Resend error' });
    }

    return res.status(200).json({ ok: true, id: data?.id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e?.message || 'Internal error' });
  }
}
