import nodemailer from 'nodemailer';

const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('Configuration SMTP incomplète');
  }

  // secure=true pour port 465 (SSL), false pour 587 (STARTTLS)
  const secure = process.env.SMTP_SECURE !== undefined
    ? String(process.env.SMTP_SECURE) === 'true'
    : port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
};

export const sendPasswordResetEmail = async (to: string, fullname: string, resetUrl: string) => {
  const transporter = getTransporter();
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || 'no-reply@localhost';

  await transporter.sendMail({
    from,
    to,
    subject: 'Réinitialisation de votre mot de passe GED FPS',
    text: [
      `Bonjour ${fullname},`,
      '',
      'Une demande de réinitialisation de mot de passe a été reçue pour votre compte GED FPS.',
      `Utilisez ce lien dans les 30 minutes : ${resetUrl}`,
      '',
      'Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.',
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <p>Bonjour ${fullname},</p>
        <p>Une demande de réinitialisation de mot de passe a été reçue pour votre compte GED FPS.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#0d5cbf;color:#ffffff;text-decoration:none;border-radius:8px;">
            Réinitialiser mon mot de passe
          </a>
        </p>
        <p>Ce lien expire dans 30 minutes.</p>
        <p>Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.</p>
      </div>
    `,
  });
};

export const sendNewAccountCredentialsEmail = async (
  to: string,
  fullname: string,
  password: string,
  appUrl: string
) => {
  const transporter = getTransporter();
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || 'no-reply@localhost';

  await transporter.sendMail({
    from,
    to,
    subject: 'Votre compte GED FPS a été créé',
    text: [
      `Bonjour ${fullname},`,
      '',
      'Votre compte GED FPS a été créé par un administrateur.',
      `Email: ${to}`,
      `Mot de passe initial: ${password}`,
      '',
      `Connectez-vous ici: ${appUrl}/login`,
      'Après votre première connexion, veuillez changer votre mot de passe.',
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <p>Bonjour ${fullname},</p>
        <p>Votre compte GED FPS a été créé par un administrateur.</p>
        <p><strong>Email:</strong> ${to}<br /><strong>Mot de passe initial:</strong> ${password}</p>
        <p>
          <a href="${appUrl}/login" style="display:inline-block;padding:10px 16px;background:#0d5cbf;color:#ffffff;text-decoration:none;border-radius:8px;">
            Se connecter
          </a>
        </p>
        <p>Après votre première connexion, veuillez changer votre mot de passe.</p>
      </div>
    `,
  });
};