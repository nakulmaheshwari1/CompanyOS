import nodemailer from 'nodemailer';
import { config } from '../config';

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  if (!config.smtpUser || !config.smtpPass) {
    console.log(`[MOCK EMAIL] To: ${to} | Subject: ${subject}\nBody: ${text}\n`);
    return { mock: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });

    const info = await transporter.sendMail({
      from: `"CompanyOS" <${config.smtpUser}>`,
      to,
      subject,
      text,
      html: html || text.replace(/\n/g, '<br>'),
    });

    return info;
  } catch (error) {
    console.error('Failed to send email:', error);
    console.log(`[FALLBACK EMAIL] To: ${to} | Subject: ${subject}\nBody: ${text}\n`);
    return { error };
  }
}
