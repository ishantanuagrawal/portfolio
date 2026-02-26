const EMAIL_BRAND = {
  company: 'SBS Media',
  primary: '#111111',
  secondary: '#5f6368',
  background: '#f7f7f5',
  panel: '#ffffff',
  border: '#e4e4e4'
};

const ACK_EMAIL_TEMPLATES = {
  client: {
    subject: 'We received your project inquiry - SBS Media',
    title: 'Project Inquiry Received',
    intro:
      'Thank you for reaching out. Your project details are in our queue, and our team will contact you shortly.',
    nextSteps: [
      'We review your requirements and timeline.',
      'We suggest a creative approach aligned to your goals.',
      'We share next steps and estimated execution plan.'
    ]
  },
  team: {
    subject: 'We received your team application - SBS Media',
    title: 'Application Received',
    intro:
      'Thank you for applying. Your profile has been received and our hiring team will review it shortly.',
    nextSteps: [
      'We evaluate your role fit and experience.',
      'Shortlisted profiles are contacted directly by email.',
      'Further process details are shared in the follow-up.'
    ]
  }
};

const escapeHtml = (value) =>
  String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const createHtmlBody = ({ title, intro, nextSteps, safeName }) => `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${EMAIL_BRAND.background};font-family:Arial,Helvetica,sans-serif;color:${EMAIL_BRAND.primary};">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${EMAIL_BRAND.background};padding:28px 14px;">
      <tr>
        <td align="center">
          <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width:620px;background:${EMAIL_BRAND.panel};border:1px solid ${EMAIL_BRAND.border};">
            <tr>
              <td style="padding:28px 30px 18px 30px;border-bottom:1px solid ${EMAIL_BRAND.border};">
                <p style="margin:0;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:${EMAIL_BRAND.secondary};font-family:'Trebuchet MS',Arial,sans-serif;">
                  ${EMAIL_BRAND.company}
                </p>
                <h1 style="margin:10px 0 0 0;font-size:30px;line-height:1.2;font-weight:600;color:${EMAIL_BRAND.primary};font-family:Georgia,'Times New Roman',serif;">
                  ${escapeHtml(title)}
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 30px 8px 30px;">
                <p style="margin:0 0 14px 0;font-size:18px;line-height:1.5;color:${EMAIL_BRAND.primary};">
                  Hi ${safeName},
                </p>
                <p style="margin:0 0 20px 0;font-size:16px;line-height:1.7;color:${EMAIL_BRAND.secondary};">
                  ${escapeHtml(intro)}
                </p>
                <p style="margin:0 0 10px 0;font-size:14px;line-height:1.6;color:${EMAIL_BRAND.primary};font-weight:700;text-transform:uppercase;letter-spacing:0.4px;">
                  What happens next
                </p>
                <ul style="margin:0;padding-left:20px;color:${EMAIL_BRAND.secondary};">
                  ${nextSteps
                    .map(
                      (step) =>
                        `<li style="margin:0 0 8px 0;font-size:15px;line-height:1.6;">${escapeHtml(step)}</li>`
                    )
                    .join('')}
                </ul>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 30px 30px 30px;">
                <p style="margin:0;font-size:15px;line-height:1.7;color:${EMAIL_BRAND.primary};">
                  Regards,<br />
                  <strong>${EMAIL_BRAND.company}</strong><br />
                  Shantanu Agrawal
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

const createTextBody = ({ intro, nextSteps, safeName }) =>
  `Hi ${safeName},

${intro}

What happens next:
- ${nextSteps.join('\n- ')}

Regards,
SBS Media
Shantanu Agrawal`;

export const buildAcknowledgementEmail = (type, rawName) => {
  const template = ACK_EMAIL_TEMPLATES[type] || ACK_EMAIL_TEMPLATES.client;
  const safeName = escapeHtml((rawName || '').trim() || 'there');

  return {
    subject: template.subject,
    body: createTextBody({ ...template, safeName }),
    htmlBody: createHtmlBody({ ...template, safeName })
  };
};

