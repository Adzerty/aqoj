import nodemailer from "nodemailer";

// Envoi du « lien magique » de connexion. En l'absence de SMTP configuré
// (typiquement en dev), on se contente d'afficher le lien dans la console.

function magicLinkHtml(url: string): string {
  return `
  <div style="background:#faf7f2;padding:32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:440px;margin:0 auto;background:#ffffff;border:1px solid #e9e2d6;border-radius:16px;padding:28px;text-align:center">
      <div style="font-size:26px;font-weight:800;color:#15936a;letter-spacing:-.5px">🎲 aqoj</div>
      <h1 style="font-size:20px;margin:18px 0 6px;color:#2a2722">Ta connexion à AQOJ</h1>
      <p style="color:#807a70;font-size:14px;line-height:1.5;margin:0 0 22px">
        Clique sur le bouton ci-dessous pour te connecter. Ce lien est valable 30 minutes
        et ne fonctionne qu'une seule fois.
      </p>
      <a href="${url}" style="display:inline-block;background:#15936a;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:9999px;font-size:15px">
        Me connecter
      </a>
      <p style="color:#a39d8e;font-size:12px;line-height:1.5;margin:22px 0 0">
        Si tu n'es pas à l'origine de cette demande, ignore simplement cet email.
      </p>
    </div>
  </div>`;
}

/**
 * Construit le transport SMTP à partir de l'environnement. Deux façons :
 *  - variables séparées EMAIL_HOST / EMAIL_PORT / EMAIL_USER / EMAIL_PASS
 *    (recommandé : pas d'encodage nécessaire si l'identifiant contient un « @ »),
 *  - ou une URL unique EMAIL_SERVER (smtp://user:pass@host:port).
 * Renvoie null si rien n'est configuré (mode dev → lien dans la console).
 */
function buildTransport(): nodemailer.Transporter | null {
  if (process.env.EMAIL_HOST) {
    const port = Number(process.env.EMAIL_PORT ?? 587);
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port,
      secure: port === 465, // 465 = SSL, 587 = STARTTLS
      auth: process.env.EMAIL_USER
        ? { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        : undefined,
    });
  }
  if (process.env.EMAIL_SERVER) return nodemailer.createTransport(process.env.EMAIL_SERVER);
  return null;
}

export async function sendMagicLink(email: string, url: string): Promise<void> {
  const from = process.env.EMAIL_FROM ?? "AQOJ <no-reply@aqoj.local>";
  const transport = buildTransport();

  if (!transport) {
    // Pas de SMTP (dev) : on affiche le lien dans la console du serveur.
    console.log(`\n📧 [AQOJ] Lien de connexion pour ${email} :\n${url}\n`);
    return;
  }

  await transport.sendMail({
    to: email,
    from,
    subject: "Ta connexion à AQOJ 🎲",
    text: `Connecte-toi à AQOJ : ${url}\n\nCe lien expire dans 30 minutes et ne sert qu'une fois. Si tu n'es pas à l'origine de cette demande, ignore cet email.`,
    html: magicLinkHtml(url),
  });
}
