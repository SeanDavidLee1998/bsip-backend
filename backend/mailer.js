// mailer.js
const axios = require('axios');

const MAILTRAP_API_TOKEN = process.env.MAILTRAP_API_TOKEN;
const MAILTRAP_SENDER = process.env.MAILTRAP_SENDER;

async function sendBulkEmail(toList, subject, html) {
  try {
    const response = await axios.post(
      'https://bulk.api.mailtrap.io/api/send',
      {
        from: { email: MAILTRAP_SENDER, name: 'Your App' },
        to: toList.map(email => ({ email })),
        subject,
        html,
        category: 'Bulk Send'
      },
      {
        headers: {
          Authorization: `Bearer ${MAILTRAP_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Mailtrap API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Mailtrap API send error:', error.response ? error.response.data : error);
    throw error;
  }
}

module.exports = { sendBulkEmail };
