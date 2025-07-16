const twilio = require('twilio');
const plivo = require('plivo');

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Initialize Plivo client only if credentials are present
let plivoClient = null;
if (process.env.PLIVO_AUTH_ID && process.env.PLIVO_AUTH_TOKEN) {
  plivoClient = new plivo.Client(
    process.env.PLIVO_AUTH_ID,
    process.env.PLIVO_AUTH_TOKEN
  );
} else {
  console.warn('Plivo credentials not set. Plivo SMS sending is disabled.');
}

// Test Twilio connection
const testTwilioConnection = async () => {
  try {
    // Try to fetch account info to test connection
    const account = await twilioClient.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
    return {
      success: true,
      message: 'Twilio connection successful',
      accountSid: account.sid,
      accountName: account.friendlyName
    };
  } catch (error) {
    return {
      success: false,
      message: `Twilio connection failed: ${error.message}`,
      error: error.message
    };
  }
};

// Test Plivo connection
const testPlivoConnection = async () => {
  if (!plivoClient) {
    return {
      success: false,
      message: 'Plivo credentials not set. Plivo SMS sending is disabled.'
    };
  }
  try {
    // Try to fetch account info to test connection
    const response = await plivoClient.accounts.get();
    return {
      success: true,
      message: 'Plivo connection successful',
      accountId: response.accountId,
      accountName: response.name
    };
  } catch (error) {
    return {
      success: false,
      message: `Plivo connection failed: ${error.message}`,
      error: error.message
    };
  }
};

// Get provider status
const getProviderStatus = async (provider) => {
  switch (provider.toLowerCase()) {
    case 'twilio':
      return await testTwilioConnection();
    case 'plivo':
      return await testPlivoConnection();
    default:
      return {
        success: false,
        message: `Unknown provider: ${provider}`
      };
  }
};

// Get all providers status
const getAllProvidersStatus = async () => {
  const [twilioStatus, plivoStatus] = await Promise.all([
    testTwilioConnection(),
    testPlivoConnection()
  ]);

  return {
    twilio: twilioStatus,
    plivo: plivoStatus,
    overall: twilioStatus.success || plivoStatus.success
  };
};

module.exports = {
  twilioClient,
  plivoClient,
  testTwilioConnection,
  testPlivoConnection,
  getProviderStatus,
  getAllProvidersStatus
}; 