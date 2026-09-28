'use strict';

// Vercel serverless function: delivers the contact form submissions on
// contact.html to nechecode@gmail.com over SMTP (Gmail).
//
// SMTP credentials are read from the server environment only. They are never
// exposed in HTML, CSS or client-side JavaScript. Configure these in the
// Vercel project's Environment Variables:
//
//   SMTP_HOST   (default: smtp.gmail.com)
//   SMTP_PORT   (default: 587)
//   SMTP_USER   (default: nechecode@gmail.com)
//   SMTP_PASS   (a Gmail App Password - NOT your normal Gmail password)

const nodemailer = require('nodemailer');

const RECIPIENT = process.env.CONTACT_RECIPIENT || 'nechecode@gmail.com';

const ALLOWED_TYPES = new Set([
  'Free 20-minute call',
  'Free business software review',
  'Website / web app',
  'App',
  'Automation',
  'MVP / product development',
  'Something else'
]);

function readBody(req, limit = 100000) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > limit) {
        req.destroy();
        resolve(null);
        return;
      }
    });
    req.on('end', () => {
      if (data === null) { resolve(null); return; }
      try { resolve(JSON.parse(data || '{}')); }
      catch (err) { resolve({}); }
    });
    req.on('error', () => resolve(null));
  });
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validate(body) {
  const name = clean(body.name);
  const email = clean(body.email);
  const company = clean(body.company);
  const lookingFor = clean(body.lookingFor);
  const help = clean(body.help);
  const message = clean(body.message);
  const errors = [];

  if (!name) errors.push('Name is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('A valid email address is required.');
  if (!ALLOWED_TYPES.has(lookingFor)) errors.push('Please choose what you are looking for.');
  if (message.length < 5) errors.push('A short message is required.');

  return { name, email, company, lookingFor, help, message, errors };
}

function buildText(data) {
  return [
    'New portfolio enquiry',
    '',
    'Name: ' + data.name,
    'Email: ' + data.email,
    'Business / Company: ' + (data.company || '-'),
    'What are you looking for: ' + data.lookingFor,
    'What can I help with: ' + (data.help || '-'),
    '',
    'Message:',
    data.message
  ].join('\n');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  const body = await readBody(req);
  if (!body) {
    res.status(400).json({ ok: false, error: 'Request body is too large or unreadable.' });
    return;
  }

  const data = validate(body);
  if (data.errors.length) {
    res.status(400).json({ ok: false, errors: data.errors });
    return;
  }

  const smtpPass = process.env.SMTP_PASS;
  if (!smtpPass) {
    // Server-side only: tells the visitor to use the direct email instead of
    // pretending the message was delivered.
    res.status(500).json({
      ok: false,
      error: 'Mail delivery is not configured yet. Please email nechecode@gmail.com directly.'
    });
    return;
  }

  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER || 'nechecode@gmail.com';

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass }
  });

  try {
    await transporter.sendMail({
      from: '"neche_codes" <' + smtpUser + '>',
      to: RECIPIENT,
      replyTo: data.email,
      subject: 'New portfolio enquiry: ' + data.lookingFor,
      text: buildText(data)
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Contact form delivery failed:', err && err.message ? err.message : err);
    res.status(500).json({
      ok: false,
      error: 'Could not deliver the message. Please email nechecode@gmail.com directly.'
    });
  }
};