export const ACK_EMAIL_TEMPLATES = {
  client: {
    subject: 'We received your project inquiry - SBS Media',
    body: `Hi {name},

Thanks for contacting SBS Media. We have received your project inquiry and will get back to you shortly.

- SBS Media`
  },
  team: {
    subject: 'We received your team application - SBS Media',
    body: `Hi {name},

Thanks for applying to SBS Media. We have received your application and our team will review it.

- SBS Media, (Shantanu )`
  }
};

export const buildAcknowledgementEmail = (type, rawName) => {
  const template = ACK_EMAIL_TEMPLATES[type] || ACK_EMAIL_TEMPLATES.client;
  const safeName = (rawName || '').trim() || 'there';
  return {
    subject: template.subject,
    body: template.body.replaceAll('{name}', safeName)
  };
};
