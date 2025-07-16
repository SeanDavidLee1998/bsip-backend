const { twilioClient, plivoClient } = require('../utils/smsClients');

// Delay function for throttling
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Validate phone number format
const validatePhoneNumber = (phoneNumber) => {
  // Remove all non-digit characters except +
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // Check if it's a valid international format
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(cleaned);
};

// Format phone number for sending
const formatPhoneNumber = (phoneNumber) => {
  // Remove all non-digit characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // If no + prefix, assume US number and add +1
  if (!cleaned.startsWith('+')) {
    if (cleaned.length === 10) {
      cleaned = '+1' + cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      cleaned = '+' + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }
  }
  
  return cleaned;
};

// Send SMS via Twilio
const sendSMSViaTwilio = async (to, messageText, fromNumber = null) => {
  try {
    const message = await twilioClient.messages.create({
      body: messageText,
      from: fromNumber || process.env.TWILIO_PHONE_NUMBER,
      to: formatPhoneNumber(to)
    });

    return {
      success: true,
      messageId: message.sid,
      status: message.status,
      to: to,
      provider: 'twilio'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      code: error.code,
      to: to,
      provider: 'twilio'
    };
  }
};

// Send SMS via Plivo
const sendSMSViaPlivo = async (to, messageText, fromNumber = null) => {
  try {
    const message = await plivoClient.messages.create({
      src: fromNumber || process.env.PLIVO_PHONE_NUMBER,
      dst: formatPhoneNumber(to),
      text: messageText
    });

    return {
      success: true,
      messageId: message.messageUuid,
      status: message.status,
      to: to,
      provider: 'plivo'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      code: error.code,
      to: to,
      provider: 'plivo'
    };
  }
};

// Main bulk SMS function
const sendBulkSMS = async (provider, phoneNumbers, messageText, options = {}) => {
  const {
    delayMs = 1000, // 1 second delay between sends
    fromNumber = null, // Custom from number
    maxRetries = 3, // Maximum retry attempts
    retryDelay = 2000 // Delay between retries
  } = options;

  // Validate provider
  const validProviders = ['twilio', 'plivo'];
  if (!validProviders.includes(provider.toLowerCase())) {
    throw new Error(`Invalid provider. Must be one of: ${validProviders.join(', ')}`);
  }

  // Validate phone numbers
  const validNumbers = [];
  const invalidNumbers = [];

  phoneNumbers.forEach(phone => {
    if (validatePhoneNumber(phone)) {
      validNumbers.push(phone);
    } else {
      invalidNumbers.push(phone);
    }
  });

  if (validNumbers.length === 0) {
    throw new Error('No valid phone numbers provided');
  }

  const results = {
    provider: provider.toLowerCase(),
    total: validNumbers.length,
    successful: [],
    failed: [],
    invalid: invalidNumbers,
    startTime: new Date(),
    endTime: null,
    duration: null,
    successRate: 0
  };

  console.log(`Starting bulk SMS send via ${provider} to ${validNumbers.length} recipients`);

  // Send SMS to each valid number
  for (let i = 0; i < validNumbers.length; i++) {
    const phoneNumber = validNumbers[i];
    const attemptNumber = i + 1;
    let lastError = null;

    // Retry logic
    for (let retry = 0; retry <= maxRetries; retry++) {
      try {
        let result;
        
        if (provider.toLowerCase() === 'twilio') {
          result = await sendSMSViaTwilio(phoneNumber, messageText, fromNumber);
        } else {
          result = await sendSMSViaPlivo(phoneNumber, messageText, fromNumber);
        }

        if (result.success) {
          console.log(`✓ SMS ${attemptNumber}/${validNumbers.length} sent successfully to ${phoneNumber} via ${provider}`);
          results.successful.push({
            ...result,
            timestamp: new Date(),
            attempt: attemptNumber,
            retries: retry
          });
          break; // Success, exit retry loop
        } else {
          lastError = result.error;
          if (retry < maxRetries) {
            console.log(`⚠ SMS ${attemptNumber}/${validNumbers.length} failed for ${phoneNumber}, retrying... (${retry + 1}/${maxRetries + 1})`);
            await delay(retryDelay);
          }
        }
      } catch (error) {
        lastError = error.message;
        if (retry < maxRetries) {
          console.log(`⚠ SMS ${attemptNumber}/${validNumbers.length} error for ${phoneNumber}, retrying... (${retry + 1}/${maxRetries + 1})`);
          await delay(retryDelay);
        }
      }
    }

    // If all retries failed
    if (lastError) {
      console.log(`✗ SMS ${attemptNumber}/${validNumbers.length} failed for ${phoneNumber} after ${maxRetries + 1} attempts`);
      results.failed.push({
        to: phoneNumber,
        error: lastError,
        timestamp: new Date(),
        attempt: attemptNumber,
        retries: maxRetries + 1,
        provider: provider.toLowerCase()
      });
    }

    // Add delay between sends (except for the last one)
    if (i < validNumbers.length - 1) {
      await delay(delayMs);
    }
  }

  // Calculate final statistics
  results.endTime = new Date();
  results.duration = results.endTime - results.startTime;
  results.successRate = (results.successful.length / results.total) * 100;

  console.log(`Bulk SMS send completed via ${provider}:`);
  console.log(`- Total: ${results.total}`);
  console.log(`- Successful: ${results.successful.length}`);
  console.log(`- Failed: ${results.failed.length}`);
  console.log(`- Invalid: ${results.invalid.length}`);
  console.log(`- Success Rate: ${results.successRate.toFixed(2)}%`);
  console.log(`- Duration: ${results.duration}ms`);

  return results;
};

// Get SMS templates
const getSMSTemplates = () => {
  return {
    welcome: {
      name: 'Welcome SMS',
      content: 'Welcome to {{firmName}}! Your case {{caseType}} has been assigned to {{lawyerName}}. We\'ll keep you updated on your progress.',
      variables: ['firmName', 'caseType', 'lawyerName'],
      category: 'Onboarding'
    },
    reminder: {
      name: 'Deadline Reminder',
      content: 'URGENT: Your {{deadlineType}} is due {{dueDate}}. Please contact us immediately if you need assistance.',
      variables: ['deadlineType', 'dueDate'],
      category: 'Reminders'
    },
    update: {
      name: 'Case Update',
      content: 'Your {{caseType}} has been updated. Check your email for details or call {{firmPhone}} for immediate assistance.',
      variables: ['caseType', 'firmPhone'],
      category: 'Updates'
    },
    payment: {
      name: 'Payment Reminder',
      content: 'Payment reminder: ${{amount}} due {{dueDate}}. Call {{firmPhone}} to arrange payment or discuss options.',
      variables: ['amount', 'dueDate', 'firmPhone'],
      category: 'Billing'
    },
    appointment: {
      name: 'Appointment Confirmation',
      content: 'Your appointment with {{lawyerName}} is confirmed for {{appointmentDate}} at {{appointmentTime}}. Location: {{firmAddress}}.',
      variables: ['lawyerName', 'appointmentDate', 'appointmentTime', 'firmAddress'],
      category: 'Appointments'
    },
    legalNotice: {
      name: 'Legal Notice',
      content: 'LEGAL NOTICE: {{noticeType}} regarding {{caseType}}. Immediate response required. Contact {{lawyerName}} at {{firmPhone}}.',
      variables: ['noticeType', 'caseType', 'lawyerName', 'firmPhone'],
      category: 'Legal'
    }
  };
};

// Replace template variables
const replaceTemplateVariables = (template, variables) => {
  let content = template.content;
  
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    content = content.replace(regex, variables[key] || '');
  });
  
  return content;
};

module.exports = {
  sendBulkSMS,
  sendSMSViaTwilio,
  sendSMSViaPlivo,
  validatePhoneNumber,
  formatPhoneNumber,
  getSMSTemplates,
  replaceTemplateVariables,
  delay
}; 