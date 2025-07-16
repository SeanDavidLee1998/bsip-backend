// mailer.js
const sgMail = require('@sendgrid/mail');
require('dotenv').config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Function to send email using SendGrid
const sendEmail = async (to, subject, text) => {
  console.log('sendEmail called with:', { to, subject, text: text.substring(0, 50) + '...' });

  const msg = {
    to,
    from: process.env.SENDGRID_FROM,
    subject,
    text,
  };

  try {
    const info = await sgMail.send(msg);
    console.log('Email sent via SendGrid:', info);
    return info;
  } catch (error) {
    console.error('Error sending email via SendGrid: ', error);
    throw error;
  }
};

module.exports = { sendEmail };
