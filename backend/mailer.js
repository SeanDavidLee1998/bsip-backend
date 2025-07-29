// mailer.js
const axios = require('axios');

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
const MAILGUN_SENDER = process.env.MAILGUN_SENDER || 'noreply@yourdomain.com';

// Mailgun REST API base URL
const MAILGUN_API_URL = `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}`;

async function sendBulkEmail(toList, subject, html) {
  try {
    // Mailgun allows sending to multiple recipients in one request
    const formData = new URLSearchParams();
    formData.append('from', MAILGUN_SENDER);
    formData.append('to', toList.join(','));
    formData.append('subject', subject);
    formData.append('html', html);

    const response = await axios.post(`${MAILGUN_API_URL}/messages`, formData, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log('Mailgun API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Mailgun API send error:', error.response ? error.response.data : error);
    throw error;
  }
}

// For individual emails (if needed)
async function sendEmail(to, subject, text) {
  try {
    const formData = new URLSearchParams();
    formData.append('from', MAILGUN_SENDER);
    formData.append('to', to);
    formData.append('subject', subject);
    formData.append('text', text);

    const response = await axios.post(`${MAILGUN_API_URL}/messages`, formData, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log('Mailgun individual email response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Mailgun individual email error:', error.response ? error.response.data : error);
    throw error;
  }
}

module.exports = { sendBulkEmail, sendEmail };
