// mailer.js
const formData = require('form-data');
const Mailgun = require('mailgun.js');
const mailgun = new Mailgun(formData);

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
const MAILGUN_SENDER = process.env.MAILGUN_SENDER || 'noreply@yourdomain.com';

// Initialize Mailgun client
const mg = mailgun.client({ username: 'api', key: MAILGUN_API_KEY });

async function sendBulkEmail(toList, subject, html) {
  try {
    // Mailgun allows sending to multiple recipients in one request
    const messageData = {
      from: MAILGUN_SENDER,
      to: toList.join(','),
      subject: subject,
      html: html
    };

    const response = await mg.messages.create(MAILGUN_DOMAIN, messageData);
    console.log('Mailgun API response:', response);
    return response;
  } catch (error) {
    console.error('Mailgun API send error:', error);
    throw error;
  }
}

// For individual emails (if needed)
async function sendEmail(to, subject, text) {
  try {
    const messageData = {
      from: MAILGUN_SENDER,
      to: to,
      subject: subject,
      text: text
    };

    const response = await mg.messages.create(MAILGUN_DOMAIN, messageData);
    console.log('Mailgun individual email response:', response);
    return response;
  } catch (error) {
    console.error('Mailgun individual email error:', error);
    throw error;
  }
}

module.exports = { sendBulkEmail, sendEmail };
