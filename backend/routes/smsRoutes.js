const express = require('express');
const { sendBulkSMS, getSMSTemplates, replaceTemplateVariables, validatePhoneNumber } = require('../services/smsService');
const { getAllProvidersStatus, getProviderStatus } = require('../utils/smsClients');

const router = express.Router();

// Validation middleware for bulk SMS requests
const validateBulkSMSRequest = (req, res, next) => {
  const { recipients, messageText, provider } = req.body;
  
  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ 
      message: 'recipients must be a non-empty array' 
    });
  }
  
  if (!messageText || typeof messageText !== 'string' || messageText.trim().length === 0) {
    return res.status(400).json({ 
      message: 'messageText is required and must be a non-empty string' 
    });
  }
  
  if (!provider || !['twilio', 'plivo'].includes(provider.toLowerCase())) {
    return res.status(400).json({ 
      message: 'provider must be either "twilio" or "plivo"' 
    });
  }
  
  // Validate phone numbers
  const invalidNumbers = recipients.filter(phone => !validatePhoneNumber(phone));
  
  if (invalidNumbers.length > 0) {
    return res.status(400).json({ 
      message: 'Invalid phone numbers found', 
      invalidNumbers 
    });
  }
  
  next();
};

// Send bulk SMS endpoint
router.post('/send-bulk-sms', validateBulkSMSRequest, async (req, res) => {
  const { recipients, messageText, provider, options = {} } = req.body;
  
  console.log(`Bulk SMS request received via ${provider} for ${recipients.length} recipients`);
  
  try {
    const results = await sendBulkSMS(provider, recipients, messageText, options);
    
    res.status(200).json({
      message: 'Bulk SMS operation completed',
      results: {
        provider: results.provider,
        total: results.total,
        successful: results.successful.length,
        failed: results.failed.length,
        invalid: results.invalid.length,
        successRate: results.successRate,
        duration: results.duration,
        startTime: results.startTime,
        endTime: results.endTime,
        failedNumbers: results.failed.map(f => ({ 
          phone: f.to, 
          error: f.error,
          retries: f.retries 
        })),
        invalidNumbers: results.invalid
      }
    });
  } catch (error) {
    console.error('Bulk SMS error:', error);
    res.status(500).json({ 
      message: 'Failed to send bulk SMS', 
      error: error.message 
    });
  }
});

// Send bulk SMS with template endpoint
router.post('/send-bulk-sms-template', validateBulkSMSRequest, async (req, res) => {
  const { recipients, templateName, variables = {}, provider, options = {} } = req.body;
  
  if (!templateName) {
    return res.status(400).json({ message: 'templateName is required' });
  }
  
  const templates = getSMSTemplates();
  const template = templates[templateName];
  
  if (!template) {
    return res.status(400).json({ 
      message: 'Template not found', 
      availableTemplates: Object.keys(templates) 
    });
  }
  
  try {
    // Replace template variables
    const messageText = replaceTemplateVariables(template, variables);
    
    console.log(`Bulk SMS with template '${templateName}' via ${provider} for ${recipients.length} recipients`);
    
    const results = await sendBulkSMS(provider, recipients, messageText, options);
    
    res.status(200).json({
      message: 'Bulk SMS with template completed',
      template: templateName,
      messageText: messageText,
      results: {
        provider: results.provider,
        total: results.total,
        successful: results.successful.length,
        failed: results.failed.length,
        invalid: results.invalid.length,
        successRate: results.successRate,
        duration: results.duration,
        startTime: results.startTime,
        endTime: results.endTime,
        failedNumbers: results.failed.map(f => ({ 
          phone: f.to, 
          error: f.error,
          retries: f.retries 
        })),
        invalidNumbers: results.invalid
      }
    });
  } catch (error) {
    console.error('Bulk SMS template error:', error);
    res.status(500).json({ 
      message: 'Failed to send bulk SMS with template', 
      error: error.message 
    });
  }
});

// Get SMS templates endpoint
router.get('/sms-templates', (req, res) => {
  const templates = {
    welcome: {
      subject: 'Welcome SMS',
      content: 'Welcome to {{firmName}}! Your case {{caseType}} is now active. Call {{firmPhone}} for questions.'
    },
    reminder: {
      subject: 'Deadline Reminder',
      content: 'URGENT: {{deadlineType}} due {{dueDate}}. Call {{firmPhone}} immediately if you need help.'
    },
    update: {
      subject: 'Case Update',
      content: 'Case Update: {{caseType}} - {{lawyerName}} has an important update. Call {{firmPhone}} for details.'
    },
    payment: {
      subject: 'Payment Reminder',
      content: 'Payment due: ${{amount}} by {{dueDate}}. Call {{firmPhone}} to arrange payment or discuss options.'
    },
    appointment: {
      subject: 'Appointment Confirmation',
      content: 'Appointment confirmed: {{appointmentDate}} at {{appointmentTime}}. {{firmName}} - {{firmPhone}}'
    },
    legalNotice: {
      subject: 'Legal Notice',
      content: 'LEGAL NOTICE: {{noticeType}} requires immediate attention. Call {{firmPhone}} within 24 hours.'
    },
    deadline: {
      subject: 'Deadline Alert',
      content: 'DEADLINE ALERT: {{deadlineType}} due {{dueDate}}. Failure to meet may result in case dismissal.'
    },
    consultation: {
      subject: 'Consultation Reminder',
      content: 'Reminder: Your consultation with {{lawyerName}} is tomorrow. Call {{firmPhone}} to confirm or reschedule.'
    },
    document: {
      subject: 'Document Request',
      content: 'DOCUMENT REQUEST: Please provide {{noticeType}} documents by {{dueDate}}. Call {{firmPhone}} if you need assistance.'
    },
    status: {
      subject: 'Status Update',
      content: 'Status Update: Your {{caseType}} case has been updated. Call {{firmPhone}} for full details.'
    }
  };
  
  res.json({ templates });
});

// Test SMS provider connection endpoint
router.get('/test-sms-connection/:provider?', async (req, res) => {
  const { provider } = req.params;
  
  try {
    let result;
    
    if (provider) {
      result = await getProviderStatus(provider);
    } else {
      result = await getAllProvidersStatus();
    }
    
    res.status(200).json(result);
  } catch (error) {
    console.error('SMS connection test error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Get SMS provider status endpoint
router.get('/sms-providers-status', async (req, res) => {
  try {
    const status = await getAllProvidersStatus();
    res.status(200).json(status);
  } catch (error) {
    console.error('Error getting SMS providers status:', error);
    res.status(500).json({ 
      message: 'Failed to get SMS providers status', 
      error: error.message 
    });
  }
});

// Validate phone numbers endpoint
router.post('/validate-phone-numbers', (req, res) => {
  const { phoneNumbers } = req.body;
  
  if (!phoneNumbers || !Array.isArray(phoneNumbers)) {
    return res.status(400).json({ 
      message: 'phoneNumbers must be an array' 
    });
  }
  
  const validationResults = phoneNumbers.map(phone => ({
    phone,
    valid: validatePhoneNumber(phone)
  }));
  
  const validNumbers = validationResults.filter(r => r.valid).map(r => r.phone);
  const invalidNumbers = validationResults.filter(r => !r.valid).map(r => r.phone);
  
  res.status(200).json({
    total: phoneNumbers.length,
    valid: validNumbers.length,
    invalid: invalidNumbers.length,
    validNumbers,
    invalidNumbers,
    validationResults
  });
});

// Get SMS statistics endpoint
router.get('/sms-statistics', (req, res) => {
  // This would typically query a database for SMS statistics
  // For now, return mock data
  res.status(200).json({
    totalSent: 0,
    totalDelivered: 0,
    totalFailed: 0,
    successRate: 0,
    providers: {
      twilio: {
        totalSent: 0,
        totalDelivered: 0,
        totalFailed: 0,
        successRate: 0
      },
      plivo: {
        totalSent: 0,
        totalDelivered: 0,
        totalFailed: 0,
        successRate: 0
      }
    },
    lastUpdated: new Date().toISOString()
  });
});

module.exports = router; 