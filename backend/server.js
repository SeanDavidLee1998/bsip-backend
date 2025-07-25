// IMPORTANT: Do NOT use '?' in static route paths. Only use '?' for optional route parameters, like '/route/:param?'.
// For query parameters, use req.query, not the route path.
// This prevents path-to-regexp errors in Express.
//
// Example (GOOD): app.get('/api/item/:id?', handler)
// Example (BAD):  app.get('/api/item?', handler)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const admin = require('firebase-admin');
const { sendEmail } = require('./mailer'); // Import email function
const { sendSMS, client } = require('./smsSender'); // Import SMS function and client
const ZoomMessenger = require('./zoomMessenger'); // Import Zoom messenger
const { sendBulkEmails, testConnection, getEmailTemplates } = require('./bulkEmailSender'); // Import bulk email functions
const smsRoutes = require('./routes/smsRoutes'); // Import SMS routes

// Initialize Firebase Admin SDK
let serviceAccount;
let db;

try {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    // Use individual environment variables (for production)
    serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FIREBASE_CLIENT_EMAIL)}`
    };
    console.log('Firebase service account loaded from environment variables');
  } else {
    // Use local file (for development)
    serviceAccount = require('./firebase-service-account.json');
    console.log('Firebase service account loaded from local file');
  }
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  db = admin.firestore();
  console.log('Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('Firebase initialization error:', error.message);
  console.log('Firebase features will be disabled. Backend will still work for email/SMS.');
  
  // Initialize without credentials as fallback
  try {
    admin.initializeApp();
    db = admin.firestore();
    console.log('Firebase initialized without credentials (limited functionality)');
  } catch (fallbackError) {
    console.log('Firebase completely disabled');
    db = null;
  }
}

const app = express();
const PORT = process.env.PORT || 3001; // Changed to 3001 to avoid conflict with React

// Initialize Zoom messenger
const zoomMessenger = new ZoomMessenger();

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

// Enable CORS for frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json()); // Middleware to parse JSON requests

// --- Route Registration Logging Wrapper ---
const httpMethods = ['get', 'post', 'put', 'delete', 'patch'];
httpMethods.forEach(method => {
  const originalAppMethod = app[method].bind(app);
  app[method] = function(path, ...handlers) {
    console.log(`[ROUTE][app.${method}] Registering path:`, path);
    return originalAppMethod(path, ...handlers);
  };
});
// If you use any express.Router() instances, wrap them too:
const originalExpressRouter = express.Router;
express.Router = function(...args) {
  const router = originalExpressRouter(...args);
  httpMethods.forEach(method => {
    const originalRouterMethod = router[method].bind(router);
    router[method] = function(path, ...handlers) {
      console.log(`[ROUTE][router.${method}] Registering path:`, path);
      return originalRouterMethod(path, ...handlers);
    };
  });
  return router;
};
// --- End Route Registration Logging Wrapper ---

// Mount SMS routes
app.use('/api/sms', smsRoutes);
app.use('/sms', smsRoutes); // Alternative route prefix for backward compatibility

// Input validation middleware
const validateEmailRequest = (req, res, next) => {
  console.log('Email request received:', req.body);
  const { to, subject, text } = req.body;
  if (!to || !subject || !text) {
    console.log('Missing required fields:', { to, subject, text });
    return res.status(400).json({ message: 'Missing required fields: to, subject, text' });
  }
  if (!to.includes('@')) {
    console.log('Invalid email address:', to);
    return res.status(400).json({ message: 'Invalid email address' });
  }
  console.log('Email validation passed');
  next();
};

const validateSMSRequest = (req, res, next) => {
  const { to, body } = req.body;
  if (!to || !body) {
    return res.status(400).json({ message: 'Missing required fields: to, body' });
  }
  if (!to.match(/^\+?[1-9]\d{1,14}$/)) {
    return res.status(400).json({ message: 'Invalid phone number format' });
  }
  next();
};

// Endpoint to send email
app.post('/send-email', validateEmailRequest, async (req, res) => {
  const { to, subject, text } = req.body;
  console.log('Attempting to send email to:', to);

  try {
    const info = await sendEmail(to, subject, text);
    console.log('Email sent successfully:', info);
    res.status(200).json({ message: 'Email sent successfully', info });
  } catch (error) {
    console.error('Error sending email: ', error);
    res.status(500).json({ message: 'Failed to send email', error: error.message });
  }
});

// Endpoint to send SMS
app.post('/send-sms', validateSMSRequest, async (req, res) => {
  const { to, body } = req.body; // Destructure the request body to get 'to' and 'body'

  try {
    const message = await sendSMS(to, body); // Call the sendSMS function
    res.status(200).json({ message: 'SMS sent successfully', sid: message.sid }); // Respond with success
  } catch (error) {
    console.error('Error sending SMS: ', error); // Log the error
    res.status(500).json({ message: 'Failed to send SMS', error: error.message }); // Respond with error
  }
});

// Endpoint to check SMS status
app.get('/sms-status/:sid', async (req, res) => {
  const { sid } = req.params; // Get the message SID from the URL parameters

  try {
    const message = await client.messages(sid).fetch(); // Fetch the message status
    res.status(200).json({ message: 'Message status retrieved successfully', status: message.status });
  } catch (error) {
    console.error('Error retrieving SMS status: ', error);
    res.status(500).json({ message: 'Failed to retrieve SMS status', error: error.message });
  }
});

// Endpoint to send Zoom message
app.post('/send-zoom-message', async (req, res) => {
  const { toJID, message, type = 'direct' } = req.body; // type can be 'direct' or 'channel'

  try {
    let result;
    if (type === 'channel') {
      result = await zoomMessenger.sendChannelMessage(toJID, message);
    } else {
      result = await zoomMessenger.sendDirectMessage(toJID, message);
    }
    
    res.status(200).json({ message: 'Zoom message sent successfully', result });
  } catch (error) {
    console.error('Error sending Zoom message: ', error);
    res.status(500).json({ message: 'Failed to send Zoom message', error: error.message });
  }
});

// Endpoint to get Zoom users
app.get('/zoom-users', async (req, res) => {
  try {
    const users = await zoomMessenger.getUsers();
    res.status(200).json({ users });
  } catch (error) {
    console.error('Error getting Zoom users: ', error);
    res.status(500).json({ message: 'Failed to get Zoom users', error: error.message });
  }
});

// Endpoint to get Zoom channels
app.get('/zoom-channels', async (req, res) => {
  try {
    const channels = await zoomMessenger.getChannels();
    res.status(200).json({ channels });
  } catch (error) {
    console.error('Error getting Zoom channels: ', error);
    res.status(500).json({ message: 'Failed to get Zoom channels', error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Bulk Email Routes

// Validation middleware for bulk email requests
const validateBulkEmailRequest = (req, res, next) => {
  const { emailList, subject, htmlBody } = req.body;
  
  if (!emailList || !Array.isArray(emailList) || emailList.length === 0) {
    return res.status(400).json({ message: 'emailList must be a non-empty array' });
  }
  
  if (!subject || typeof subject !== 'string') {
    return res.status(400).json({ message: 'subject is required and must be a string' });
  }
  
  if (!htmlBody || typeof htmlBody !== 'string') {
    return res.status(400).json({ message: 'htmlBody is required and must be a string' });
  }
  
  // Validate email addresses
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const invalidEmails = emailList.filter(email => !emailRegex.test(email));
  
  if (invalidEmails.length > 0) {
    return res.status(400).json({ 
      message: 'Invalid email addresses found', 
      invalidEmails 
    });
  }
  
  next();
};

// Send bulk emails endpoint
app.post('/send-bulk-email', validateBulkEmailRequest, async (req, res) => {
  const { emailList, subject, htmlBody, options = {} } = req.body;
  
  console.log(`Bulk email request received for ${emailList.length} recipients`);
  
  try {
    const results = await sendBulkEmails(emailList, subject, htmlBody, options);
    
    res.status(200).json({
      message: 'Bulk email operation completed',
      results: {
        total: results.total,
        successful: results.successful.length,
        failed: results.failed.length,
        successRate: results.successRate,
        duration: results.duration,
        failedEmails: results.failed.map(f => ({ email: f.email, error: f.error }))
      }
    });
  } catch (error) {
    console.error('Bulk email error:', error);
    res.status(500).json({ 
      message: 'Failed to send bulk emails', 
      error: error.message 
    });
  }
});

// Test Hostinger SMTP connection
app.get('/test-bulk-email-connection', async (req, res) => {
  try {
    const result = await testConnection();
    res.status(200).json(result);
  } catch (error) {
    console.error('Connection test error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Get email templates
app.get('/email-templates', (req, res) => {
  try {
    const templates = getEmailTemplates();
    res.status(200).json({ templates });
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({ 
      message: 'Failed to get email templates', 
      error: error.message 
    });
  }
});

// API routes for bulk email (with /api prefix)
app.get('/api/bulk-email/templates', (req, res) => {
  try {
    const templates = getEmailTemplates();
    res.status(200).json(templates);
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({ 
      message: 'Failed to get email templates', 
      error: error.message 
    });
  }
});

app.get('/api/bulk-email/test-connection', async (req, res) => {
  try {
    const result = await testConnection();
    
    // If it's a quota error, return 429 status
    if (result.isQuotaError) {
      return res.status(429).json({
        success: false,
        message: result.message,
        isQuotaError: true
      });
    }
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Connection test error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

app.post('/api/bulk-email/send', validateBulkEmailRequest, async (req, res) => {
  const { emailList, subject, htmlBody, personalization = false, customData = {}, templateKey } = req.body;
  console.log(`Bulk email request received for ${emailList.length} recipients with template: ${templateKey}`);
  try {
    const results = await sendBulkEmails(emailList, subject, htmlBody, {
      personalization,
      customData
    });
    
    // Check if any emails failed due to quota limit
    const quotaErrors = results.failed.filter(f => f.isQuotaError);
    if (quotaErrors.length > 0) {
      return res.status(429).json({
        message: 'SendGrid daily email limit reached. Some emails were sent successfully.',
        results: {
          total: results.total,
          successful: results.successful.length,
          failed: results.failed.length,
          successRate: results.successRate,
          duration: results.duration,
          quotaLimitReached: true,
          failedEmails: results.failed.map(f => ({ email: f.email, error: f.error, isQuotaError: f.isQuotaError }))
        }
      });
    }
    
    // Update sent status for each successful email if templateKey is set
    if (templateKey) {
      for (const s of results.successful) {
        await updateClientTemplateSentStatus(s.email, templateKey);
      }
    }
    res.status(200).json(results);
  } catch (error) {
    console.error('Bulk email error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk Import Route
app.post('/api/bulk-import', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ 
      success: false, 
      message: 'No file uploaded' 
    });
  }

  try {
    const results = [];
    const errors = [];
    const batch = db.batch(); // Create a batch for efficient writes
    let batchCount = 0;
    const BATCH_SIZE = 500; // Firestore batch limit

    // Read and parse CSV file
    const csvRows = [];
    fs.createReadStream(req.file.path)
      .pipe(csv({ mapHeaders: ({ header }) => header && header.replace(/^\uFEFF/, '').trim().toLowerCase() }))
      .on('data', (row) => {
        csvRows.push(row);
      })
      .on('end', async () => {
        for (const row of csvRows) {
          // Map CSV columns (case-insensitive, normalized)
          const name = row['name'];
          const phone = row['phone'];
          const email = row['email'];
          const mark = row['mark'] || '';
          const serialNumber = row['serial number'] || row['serialnumber'] || row['serial_number'] || '';

          // Support multiple emails (comma or semicolon separated)
          let emails = [];
          if (email) {
            emails = email.split(/[,;]+/).map(e => e.trim()).filter(Boolean);
        }
          // Validate at least one valid email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          const validEmails = emails.filter(e => emailRegex.test(e));
          if (!name || !phone) {
            errors.push({ row: row, error: 'Missing required fields: Name or Phone' });
            continue;
          }
          if (validEmails.length === 0) {
            errors.push({ row: row, error: 'No valid email address found' });
            continue;
          }
          // Check for duplicates in Firestore (by any email)
          let duplicateFound = false;
          for (const e of validEmails) {
            const snapshot = await db.collection('clients').where('emails', 'array-contains', e).get();
            if (!snapshot.empty) {
              duplicateFound = true;
              break;
            }
          }
          if (duplicateFound) {
            errors.push({ row: row, error: 'Duplicate client (email already exists)' });
            continue;
        }
        // Validate phone format (basic validation)
        const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
          if (!phoneRegex.test(phone)) {
            errors.push({ row: row, error: 'Invalid phone format' });
            continue;
        }
          // Create client document
          const clientData = {
            name: name.trim(),
            phone: phone.trim(),
            emails: validEmails, // store as array
            mark: mark.trim(),
            serialNumber: serialNumber.trim(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          };
          // Add to batch
          const clientRef = db.collection('clients').doc();
          batch.set(clientRef, clientData);
          batchCount++;
          // Commit batch when it reaches the limit
          if (batchCount >= BATCH_SIZE) {
            try {
              await batch.commit();
              console.log(`Committed batch of ${batchCount} clients`);
            } catch (error) {
              console.error('Error committing batch:', error);
            }
            batchCount = 0;
          }
          // Add to results for response
          results.push({ id: clientRef.id, ...clientData });
        }
        // Commit any remaining documents in the batch
        if (batchCount > 0) {
          try {
            await batch.commit();
            console.log(`Committed final batch of ${batchCount} clients`);
          } catch (error) {
            console.error('Error committing final batch:', error);
          }
        }
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        console.log(`Bulk import completed: ${results.length} valid records, ${errors.length} errors`);
        res.status(200).json({
          success: true,
          message: `Successfully imported ${results.length} clients to Firestore`,
          imported: results.length,
          errors: errors.length,
          data: results,
          errorDetails: errors
        });
      })
      .on('error', (error) => {
        // Clean up uploaded file
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        console.error('CSV parsing error:', error);
        res.status(500).json({
          success: false,
          message: 'Error parsing CSV file',
          error: error.message
        });
      });

  } catch (error) {
    // Clean up uploaded file
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error('Bulk import error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process import',
      error: error.message
    });
  }
});

const updateClientTemplateSentStatus = async (email, templateKey) => {
  try {
    // Find client by email (in emails array)
    const snapshot = await db.collection('clients').where('emails', 'array-contains', email).get();
    if (!snapshot.empty) {
      const clientRef = snapshot.docs[0].ref;
      const clientData = snapshot.docs[0].data();
      
      // Ensure sentTemplates exists and is an object
      const sentTemplates = clientData.sentTemplates || {};
      
      // Only update if templateKey is defined
      if (templateKey) {
        sentTemplates[templateKey] = true;
        await clientRef.update({ sentTemplates });
        console.log(`Updated sent status for email ${email} and template ${templateKey}`);
      }
    } else {
      console.log(`No client found for email: ${email}`);
    }
  } catch (error) {
    console.error(`Error updating template sent status for email ${email}:`, error);
    // Don't throw the error - just log it so it doesn't break the email sending
  }
};

// New endpoint: Get clients with sent status for a template
app.get('/api/clients-with-template-status', async (req, res) => {
  const templateKey = req.query.template;
  if (!templateKey) {
    return res.status(400).json({ error: 'Missing template query param' });
  }
  try {
    const snapshot = await db.collection('clients').get();
    const clients = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        emails: data.emails,
        mark: data.mark,
        serialNumber: data.serialNumber,
        sent: data.sentTemplates && data.sentTemplates[templateKey] === true
      };
    });
    res.status(200).json({ clients });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log('Environment variables loaded:', {
    SMTP_HOST: process.env.SMTP_HOST || 'default',
    SMTP_USER: process.env.SMTP_USER ? '***' + process.env.SMTP_USER.slice(-4) : 'Not set',
    SMTP_PASS: process.env.SMTP_PASS ? 'Set' : 'Not set'
  });
});
