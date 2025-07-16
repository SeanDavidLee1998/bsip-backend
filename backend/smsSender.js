// smsSender.js
const twilio = require('twilio');

// Twilio credentials - use environment variables only
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new twilio(accountSid, authToken);

// Function to send SMS
const sendSMS = (to, body) => {
  return client.messages.create({
    body,
    to, // Text this number
    from: process.env.TWILIO_PHONE_NUMBER, // From a valid Twilio number
  });
};

module.exports = { sendSMS, client };
