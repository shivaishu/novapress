import nodemailer from 'nodemailer';

let transporter;
function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.EMAIL_FROM) return null;
  if (!transporter) transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  return transporter;
}

export async function sendEmail({ to, subject, text }) {
  const mailer = getTransporter();
  if (!mailer || !to) return false;
  try { await mailer.sendMail({ from: process.env.EMAIL_FROM, to, subject, text }); return true; }
  catch (error) { console.error('Email delivery failed:', error.message); return false; }
}
