const { sendBulkEmail } = require('./mailer');
require('dotenv').config();

// Delay function for throttling
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const EXCLUDED_EMAILS = [
  'notifications@trademarkengine.com',
  'tmapp@legalzoom.com'
];

// Send bulk emails with delay between messages
const sendBulkEmails = async (emailList, subject, htmlBody, options = {}) => {
  // Exclude unwanted emails
  const filteredEmailList = emailList.filter(
    email => !EXCLUDED_EMAILS.includes(email.toLowerCase())
  );
  // Use filteredEmailList for sending
  const {
    personalization = false, // Whether to personalize emails
    customData = {} // Custom data for personalization
  } = options;

  // If personalization is needed, send individually (Mailtrap API does not support per-recipient personalization in one call)
  if (personalization && Object.keys(customData).length > 0) {
    const results = { successful: [], failed: [], total: filteredEmailList.length };
    for (const email of filteredEmailList) {
      let finalHtmlBody = htmlBody;
      let finalSubject = subject;
      if (customData[email]) {
        const data = customData[email];
        
        // Replace all template variables in both subject and HTML body
        Object.keys(data).forEach(key => {
          const placeholder = `{{${key}}}`;
          const value = data[key] || '';
          finalHtmlBody = finalHtmlBody.replace(new RegExp(placeholder, 'g'), value);
          finalSubject = finalSubject.replace(new RegExp(placeholder, 'g'), value);
        });
        
        console.log(`Personalized email for ${email}:`, {
          subject: finalSubject,
          htmlLength: finalHtmlBody.length
        });
      }
      try {
        await sendBulkEmail([email], finalSubject, finalHtmlBody);
        results.successful.push({ email });
      } catch (error) {
        results.failed.push({ email, error: error.message });
      }
    }
    return results;
  }

  // Otherwise, send all at once
  try {
    await sendBulkEmail(filteredEmailList, subject, htmlBody);
    return { 
      successful: filteredEmailList.map(email => ({ email })), 
      failed: [], 
      total: filteredEmailList.length 
    };
  } catch (error) {
    return { 
      successful: [], 
      failed: filteredEmailList.map(email => ({ email, error: error.message })), 
      total: filteredEmailList.length 
    };
  }
};

// Test SMTP connection
const testConnection = async () => {
  try {
    await sendBulkEmail(['test@example.com'], 'Test Email from SendGrid', '<h1>This is a test email from SendGrid.</h1>');
    return { success: true, message: 'SendGrid connection successful' };
  } catch (error) {
    return { 
      success: false, 
      message: error.message,
      isQuotaError: false // Mailtrap does not have a direct quota limit error like SendGrid
    };
  }
};

// Get comprehensive legal email templates
const getEmailTemplates = () => {
  return {
    // Client Onboarding Templates
    welcomeEmail: {
      subject: 'Welcome to {{firmName}} - Your Legal Journey Begins',
      html: `
        <div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; line-height: 1.6;">
          <div style="background-color: #2c3e50; color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">{{firmName}}</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px;">Professional Legal Services</p>
          </div>
          
          <div style="padding: 40px; background-color: #ffffff;">
            <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">Welcome, {{clientName}}!</h2>
            
            <p>Dear {{clientName}},</p>
            
            <p>On behalf of {{firmName}}, I am delighted to welcome you as our valued client. We are honored that you have chosen us to represent your legal interests.</p>
            
            <div style="background-color: #ecf0f1; padding: 20px; margin: 20px 0; border-left: 4px solid #3498db;">
              <h3 style="color: #2c3e50; margin-top: 0;">What to Expect Next:</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li>Initial consultation scheduling within 24-48 hours</li>
                <li>Detailed case assessment and strategy development</li>
                <li>Regular updates on your case progress</li>
                <li>Direct access to your legal team</li>
              </ul>
            </div>
            
            <p>Our team of experienced attorneys is committed to providing you with the highest level of legal representation. We understand that each case is unique, and we will work tirelessly to achieve the best possible outcome for you.</p>
            
            <p><strong>Your Case Type:</strong> {{caseType}}</p>
            <p><strong>Assigned Attorney:</strong> {{lawyerName}}</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <h4 style="color: #2c3e50; margin-top: 0;">Important Contact Information:</h4>
              <p style="margin: 5px 0;"><strong>Phone:</strong> {{firmPhone}}</p>
              <p style="margin: 5px 0;"><strong>Email:</strong> {{firmEmail}}</p>
              <p style="margin: 5px 0;"><strong>Address:</strong> {{firmAddress}}</p>
            </div>
            
            <p>If you have any questions or need immediate assistance, please do not hesitate to contact us. We are here to help you navigate through your legal matters with confidence and peace of mind.</p>
            
            <p>Thank you for trusting us with your legal needs.</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>{{lawyerName}}</strong><br>
              <em>{{firmName}}</em>
            </p>
          </div>
          
          <div style="background-color: #34495e; color: white; padding: 20px; text-align: center; font-size: 12px;">
            <p style="margin: 0;">This email is confidential and intended for the recipient only.</p>
            <p style="margin: 5px 0;">{{firmName}} | {{firmAddress}} | {{firmPhone}}</p>
          </div>
        </div>
      `
    },
    
    signupConfirmation: {
      subject: 'Package Confirmation - {{packageName}} - {{firmName}}',
      html: `
        <div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; line-height: 1.6;">
          <div style="background-color: #27ae60; color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">{{firmName}}</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px;">Package Confirmation</p>
          </div>
          
          <div style="padding: 40px; background-color: #ffffff;">
            <h2 style="color: #2c3e50; border-bottom: 2px solid #27ae60; padding-bottom: 10px;">Package Confirmation</h2>
            
            <p>Dear {{clientName}},</p>
            
            <p>Thank you for selecting our <strong>{{packageName}}</strong> package. We are pleased to confirm your enrollment and look forward to providing you with exceptional legal services.</p>
            
            <div style="background-color: #d5f4e6; padding: 25px; margin: 25px 0; border: 2px solid #27ae60; border-radius: 8px;">
              <h3 style="color: #27ae60; margin-top: 0; text-align: center;">Package Details</h3>
              <div style="text-align: center; margin: 20px 0;">
                <h4 style="color: #2c3e50; margin: 0;">{{packageName}}</h4>
                <p style="font-size: 24px; color: #27ae60; font-weight: bold; margin: 10px 0;">{{packagePrice}}</p>
              </div>
            </div>
            
            <div style="background-color: #ecf0f1; padding: 20px; margin: 20px 0; border-left: 4px solid #27ae60;">
              <h4 style="color: #2c3e50; margin-top: 0;">What's Included:</h4>
              <ul style="margin: 0; padding-left: 20px;">
                <li>Comprehensive legal consultation</li>
                <li>Document preparation and filing</li>
                <li>Ongoing case monitoring</li>
                <li>Regular status updates</li>
                <li>Direct attorney access</li>
                <li>Priority client support</li>
              </ul>
            </div>
            
            <p><strong>Next Steps:</strong></p>
            <ol style="margin: 0; padding-left: 20px;">
              <li>Complete any required documentation</li>
              <li>Schedule your initial consultation</li>
              <li>Provide additional case details</li>
              <li>Begin case preparation</li>
            </ol>
            
            <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <h4 style="color: #2c3e50; margin-top: 0;">Payment Information:</h4>
              <p style="margin: 5px 0;"><strong>Package:</strong> {{packageName}}</p>
              <p style="margin: 5px 0;"><strong>Amount:</strong> {{packagePrice}}</p>
              <p style="margin: 5px 0;"><strong>Status:</strong> Confirmed</p>
            </div>
            
            <p>If you have any questions about your package or need to make any modifications, please contact us immediately.</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>{{lawyerName}}</strong><br>
              <em>{{firmName}}</em>
            </p>
          </div>
          
          <div style="background-color: #34495e; color: white; padding: 20px; text-align: center; font-size: 12px;">
            <p style="margin: 0;">This email is confidential and intended for the recipient only.</p>
            <p style="margin: 5px 0;">{{firmName}} | {{firmAddress}} | {{firmPhone}}</p>
          </div>
        </div>
      `
    },
    
    // Legal Communication Templates
    ceaseAndDesist: {
      subject: 'CEASE AND DESIST NOTICE - Trademark Infringement: {{trademarkName}}',
      html: `
        <div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; line-height: 1.6;">
          <div style="background-color: #e74c3c; color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; text-transform: uppercase;">Cease and Desist Notice</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px;">Legal Notice - Immediate Action Required</p>
          </div>
          
          <div style="padding: 40px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 30px;">
              <p style="margin: 0; font-size: 14px;">{{firmName}}</p>
              <p style="margin: 5px 0; font-size: 14px;">{{firmAddress}}</p>
              <p style="margin: 5px 0; font-size: 14px;">{{firmPhone}} | {{firmEmail}}</p>
            </div>
            
            <p style="margin-bottom: 20px;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            <p style="margin-bottom: 20px;"><strong>To:</strong> {{infringingParty}}</p>
            
            <div style="background-color: #fff3cd; border: 2px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <h3 style="color: #856404; margin-top: 0; text-align: center;">URGENT LEGAL NOTICE</h3>
              <p style="text-align: center; font-weight: bold; color: #856404;">This notice requires your immediate attention and response.</p>
            </div>
            
            <p>Dear {{infringingParty}},</p>
            
            <p>This letter serves as formal notice that you are currently engaging in activities that constitute trademark infringement under federal and state law. Our client, {{clientName}}, is the rightful owner of the trademark "<strong>{{trademarkName}}</strong>" (hereinafter "the Mark").</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-left: 4px solid #e74c3c;">
              <h4 style="color: #2c3e50; margin-top: 0;">Alleged Infringing Activities:</h4>
              <ul style="margin: 0; padding-left: 20px;">
                <li>Unauthorized use of the trademark "{{trademarkName}}"</li>
                <li>Commercial exploitation of our client's intellectual property</li>
                <li>Potential consumer confusion and brand dilution</li>
                <li>Unfair competition practices</li>
              </ul>
            </div>
            
            <p><strong>Legal Basis:</strong></p>
            <p>Our client's rights in the Mark are protected under:</p>
            <ul style="margin: 0; padding-left: 20px;">
              <li>15 U.S.C. § 1114 (Lanham Act)</li>
              <li>15 U.S.C. § 1125 (False Designation of Origin)</li>
              <li>State trademark laws</li>
              <li>Common law trademark rights</li>
            </ul>
            
            <div style="background-color: #fff3cd; border: 2px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <h4 style="color: #856404; margin-top: 0;">DEMAND FOR IMMEDIATE ACTION:</h4>
              <p>You are hereby demanded to:</p>
              <ol style="margin: 0; padding-left: 20px;">
                <li><strong>Immediately cease and desist</strong> from all use of the Mark</li>
                <li><strong>Remove all infringing materials</strong> from public display</li>
                <li><strong>Destroy all infringing merchandise</strong> and marketing materials</li>
                <li><strong>Provide written confirmation</strong> of compliance within {{responseDeadline}} days</li>
              </ol>
            </div>
            
            <p><strong>Consequences of Non-Compliance:</strong></p>
            <p>Failure to comply with this notice may result in:</p>
            <ul style="margin: 0; padding-left: 20px;">
              <li>Legal action seeking injunctive relief</li>
              <li>Monetary damages including statutory damages</li>
              <li>Attorneys' fees and costs</li>
              <li>Additional legal remedies available under law</li>
            </ul>
            
            <p><strong>Response Required:</strong></p>
            <p>You must respond to this notice in writing within <strong>{{responseDeadline}} days</strong> of receipt, confirming your compliance with the above demands. Your response should be sent to:</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <p style="margin: 5px 0;"><strong>{{lawyerName}}</strong></p>
              <p style="margin: 5px 0;">{{firmName}}</p>
              <p style="margin: 5px 0;">{{firmAddress}}</p>
              <p style="margin: 5px 0;">{{firmEmail}}</p>
            </div>
            
            <p>This notice is sent without prejudice to any rights or remedies our client may have, all of which are expressly reserved.</p>
            
            <p style="margin-top: 30px;">
              Sincerely,<br>
              <strong>{{lawyerName}}</strong><br>
              <em>{{firmName}}</em>
            </p>
          </div>
          
          <div style="background-color: #34495e; color: white; padding: 20px; text-align: center; font-size: 12px;">
            <p style="margin: 0;">This is a legal document. Please consult with legal counsel before responding.</p>
            <p style="margin: 5px 0;">{{firmName}} | {{firmAddress}} | {{firmPhone}}</p>
          </div>
        </div>
      `
    },
    
    trademarkOpposition: {
      subject: 'TRADEMARK OPPOSITION NOTICE - {{trademarkName}} - {{firmName}}',
      html: `
        <div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; line-height: 1.6;">
          <div style="background-color: #f39c12; color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">Trademark Opposition Notice</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px;">Legal Opposition Filed</p>
          </div>
          
          <div style="padding: 40px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 30px;">
              <p style="margin: 0; font-size: 14px;">{{firmName}}</p>
              <p style="margin: 5px 0; font-size: 14px;">{{firmAddress}}</p>
              <p style="margin: 5px 0; font-size: 14px;">{{firmPhone}} | {{firmEmail}}</p>
            </div>
            
            <p style="margin-bottom: 20px;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            <p style="margin-bottom: 20px;"><strong>To:</strong> {{infringingParty}}</p>
            
            <div style="background-color: #fff3cd; border: 2px solid #f39c12; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <h3 style="color: #856404; margin-top: 0; text-align: center;">TRADEMARK OPPOSITION NOTICE</h3>
              <p style="text-align: center; font-weight: bold; color: #856404;">Formal opposition has been filed against your trademark application.</p>
            </div>
            
            <p>Dear {{infringingParty}},</p>
            
            <p>This letter serves as formal notice that our client, {{clientName}}, has filed an opposition to your trademark application for "<strong>{{trademarkName}}</strong>" with the United States Patent and Trademark Office (USPTO).</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-left: 4px solid #f39c12;">
              <h4 style="color: #2c3e50; margin-top: 0;">Opposition Details:</h4>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Opposed Mark:</strong> {{trademarkName}}</li>
                <li><strong>Opposition Number:</strong> [To be assigned by USPTO]</li>
                <li><strong>Filing Date:</strong> ${new Date().toLocaleDateString()}</li>
                <li><strong>Grounds for Opposition:</strong> Likelihood of confusion, dilution, and other statutory grounds</li>
              </ul>
            </div>
            
            <p><strong>Legal Basis for Opposition:</strong></p>
            <p>Our client opposes your application on the following grounds:</p>
            <ol style="margin: 0; padding-left: 20px;">
              <li><strong>Likelihood of Confusion:</strong> Your mark is confusingly similar to our client's existing trademark</li>
              <li><strong>Dilution:</strong> Your use would dilute the distinctive quality of our client's famous mark</li>
              <li><strong>Prior Rights:</strong> Our client has superior rights in the mark</li>
              <li><strong>Bad Faith:</strong> Your application was filed in bad faith</li>
            </ol>
            
            <div style="background-color: #fff3cd; border: 2px solid #f39c12; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <h4 style="color: #856404; margin-top: 0;">Required Response:</h4>
              <p>You must file an answer to this opposition within <strong>40 days</strong> of the notice of opposition. Failure to respond will result in a default judgment against your application.</p>
            </div>
            
            <p><strong>Next Steps:</strong></p>
            <ul style="margin: 0; padding-left: 20px;">
              <li>Consult with legal counsel immediately</li>
              <li>Review the opposition filing in detail</li>
              <li>Prepare and file your answer within the deadline</li>
              <li>Consider settlement discussions if appropriate</li>
            </ul>
            
            <p><strong>Contact Information:</strong></p>
            <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <p style="margin: 5px 0;"><strong>{{lawyerName}}</strong></p>
              <p style="margin: 5px 0;">{{firmName}}</p>
              <p style="margin: 5px 0;">{{firmAddress}}</p>
              <p style="margin: 5px 0;">{{firmEmail}}</p>
            </div>
            
            <p>This notice is sent without prejudice to any rights or remedies our client may have, all of which are expressly reserved.</p>
            
            <p style="margin-top: 30px;">
              Sincerely,<br>
              <strong>{{lawyerName}}</strong><br>
              <em>{{firmName}}</em>
            </p>
          </div>
          
          <div style="background-color: #34495e; color: white; padding: 20px; text-align: center; font-size: 12px;">
            <p style="margin: 0;">This is a legal document. Please consult with legal counsel before responding.</p>
            <p style="margin: 5px 0;">{{firmName}} | {{firmAddress}} | {{firmPhone}}</p>
          </div>
        </div>
      `
    },
    
    // Client Communication Templates
    deadlineReminder: {
      subject: 'URGENT: Deadline Reminder - {{deadlineType}} Due {{dueDate}}',
      html: `
        <div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; line-height: 1.6;">
          <div style="background-color: #e67e22; color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">Deadline Reminder</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px;">Action Required - {{deadlineType}}</p>
          </div>
          
          <div style="padding: 40px; background-color: #ffffff;">
            <h2 style="color: #2c3e50; border-bottom: 2px solid #e67e22; padding-bottom: 10px;">Important Deadline Notice</h2>
            
            <p>Dear {{clientName}},</p>
            
            <div style="background-color: #fff3cd; border: 2px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <h3 style="color: #856404; margin-top: 0; text-align: center;">URGENT DEADLINE APPROACHING</h3>
              <p style="text-align: center; font-weight: bold; color: #856404; font-size: 18px;">{{deadlineType}} - Due: {{dueDate}}</p>
            </div>
            
            <p>This is an important reminder that your <strong>{{deadlineType}}</strong> is due on <strong>{{dueDate}}</strong>. This deadline is critical to the success of your case and must be met to avoid potential negative consequences.</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-left: 4px solid #e67e22;">
              <h4 style="color: #2c3e50; margin-top: 0;">Required Actions:</h4>
              <ul style="margin: 0; padding-left: 20px;">
                <li>Review all required documentation</li>
                <li>Ensure all forms are properly completed</li>
                <li>Submit any missing information</li>
                <li>Contact our office if you have questions</li>
              </ul>
            </div>
            
            <p><strong>Case Information:</strong></p>
            <ul style="margin: 0; padding-left: 20px;">
              <li><strong>Case Type:</strong> {{caseType}}</li>
              <li><strong>Assigned Attorney:</strong> {{lawyerName}}</li>
              <li><strong>Deadline Type:</strong> {{deadlineType}}</li>
              <li><strong>Due Date:</strong> {{dueDate}}</li>
            </ul>
            
            <div style="background-color: #ecf0f1; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <h4 style="color: #2c3e50; margin-top: 0;">Consequences of Missing Deadline:</h4>
              <p>Failure to meet this deadline may result in:</p>
              <ul style="margin: 0; padding-left: 20px;">
                <li>Case dismissal or adverse rulings</li>
                <li>Additional filing fees</li>
                <li>Delays in case resolution</li>
                <li>Potential loss of rights</li>
              </ul>
            </div>
            
            <p><strong>Immediate Action Required:</strong></p>
            <p>Please contact our office immediately if:</p>
            <ul style="margin: 0; padding-left: 20px;">
              <li>You need assistance with documentation</li>
              <li>You have questions about the deadline</li>
              <li>You need to request an extension</li>
              <li>You have additional information to provide</li>
            </ul>
            
            <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <h4 style="color: #2c3e50; margin-top: 0;">Contact Information:</h4>
              <p style="margin: 5px 0;"><strong>Phone:</strong> {{firmPhone}}</p>
              <p style="margin: 5px 0;"><strong>Email:</strong> {{firmEmail}}</p>
              <p style="margin: 5px 0;"><strong>Address:</strong> {{firmAddress}}</p>
            </div>
            
            <p>We are here to help you meet this deadline successfully. Please do not hesitate to reach out to us.</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>{{lawyerName}}</strong><br>
              <em>{{firmName}}</em>
            </p>
          </div>
          
          <div style="background-color: #34495e; color: white; padding: 20px; text-align: center; font-size: 12px;">
            <p style="margin: 0;">This email is confidential and intended for the recipient only.</p>
            <p style="margin: 5px 0;">{{firmName}} | {{firmAddress}} | {{firmPhone}}</p>
          </div>
        </div>
      `
    },
    
    paymentReminder: {
      subject: 'Payment Reminder - Outstanding Balance: {{amount}} - Due: {{dueDate}}',
      html: `
        <div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; line-height: 1.6;">
          <div style="background-color: #e74c3c; color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">Payment Reminder</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px;">Outstanding Balance Notice</p>
          </div>
          
          <div style="padding: 40px; background-color: #ffffff;">
            <h2 style="color: #2c3e50; border-bottom: 2px solid #e74c3c; padding-bottom: 10px;">Payment Due Notice</h2>
            
            <p>Dear {{clientName}},</p>
            
            <div style="background-color: #fff3cd; border: 2px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <h3 style="color: #856404; margin-top: 0; text-align: center;">PAYMENT OVERDUE</h3>
              <p style="text-align: center; font-weight: bold; color: #856404; font-size: 18px;">Amount Due: {{amount}} | Due Date: {{dueDate}}</p>
            </div>
            
            <p>This is a friendly reminder that payment of <strong>{{amount}}</strong> is due on <strong>{{dueDate}}</strong>. This payment is important to maintain the continuity of your legal services.</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-left: 4px solid #e74c3c;">
              <h4 style="color: #2c3e50; margin-top: 0;">Payment Details:</h4>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Amount Due:</strong> {{amount}}</li>
                <li><strong>Due Date:</strong> {{dueDate}}</li>
                <li><strong>Case Type:</strong> {{caseType}}</li>
                <li><strong>Assigned Attorney:</strong> {{lawyerName}}</li>
              </ul>
            </div>
            
            <p><strong>Payment Options:</strong></p>
            <ul style="margin: 0; padding-left: 20px;">
              <li>Online payment through our secure portal</li>
              <li>Check or money order mailed to our office</li>
              <li>Bank transfer (contact us for details)</li>
              <li>Credit card payment over the phone</li>
            </ul>
            
            <div style="background-color: #ecf0f1; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <h4 style="color: #2c3e50; margin-top: 0;">Late Payment Consequences:</h4>
              <p>Please note that late payments may result in:</p>
              <ul style="margin: 0; padding-left: 20px;">
                <li>Late payment fees</li>
                <li>Suspension of legal services</li>
                <li>Collection proceedings</li>
                <li>Additional legal costs</li>
              </ul>
            </div>
            
            <p><strong>Payment Arrangements:</strong></p>
            <p>If you are experiencing financial difficulties, please contact us immediately to discuss payment arrangements. We are committed to working with you to find a solution that works for both parties.</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <h4 style="color: #2c3e50; margin-top: 0;">Contact Information:</h4>
              <p style="margin: 5px 0;"><strong>Phone:</strong> {{firmPhone}}</p>
              <p style="margin: 5px 0;"><strong>Email:</strong> {{firmEmail}}</p>
              <p style="margin: 5px 0;"><strong>Address:</strong> {{firmAddress}}</p>
            </div>
            
            <p>Thank you for your prompt attention to this matter. We appreciate your business and look forward to continuing to serve your legal needs.</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>{{lawyerName}}</strong><br>
              <em>{{firmName}}</em>
            </p>
          </div>
          
          <div style="background-color: #34495e; color: white; padding: 20px; text-align: center; font-size: 12px;">
            <p style="margin: 0;">This email is confidential and intended for the recipient only.</p>
            <p style="margin: 5px 0;">{{firmName}} | {{firmAddress}} | {{firmPhone}}</p>
          </div>
        </div>
      `
    },
    
    // General Templates
    newsletter: {
      subject: 'Monthly Newsletter - {{company}}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Hello {{name}},</h2>
          <p>Thank you for being part of our community!</p>
          <p>Here's our latest newsletter with updates and insights.</p>
          <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0;">
            <h3>Latest Updates</h3>
            <ul>
              <li>New features and improvements</li>
              <li>Industry insights and trends</li>
              <li>Upcoming events and webinars</li>
            </ul>
          </div>
          <p>Best regards,<br>The {{company}} Team</p>
        </div>
      `
    },
    announcement: {
      subject: 'Important Announcement from {{company}}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #e74c3c;">Important Announcement</h2>
          <p>Dear {{name}},</p>
          <p>We have an important announcement to share with you.</p>
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 20px 0;">
            <p><strong>Please read this carefully as it may affect your account.</strong></p>
          </div>
          <p>If you have any questions, please don't hesitate to contact us.</p>
          <p>Best regards,<br>The {{company}} Team</p>
        </div>
      `
    },
    promotion: {
      subject: 'Special Offer Just for You - {{company}}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #27ae60;">Special Offer!</h2>
          <p>Hello {{name}},</p>
          <p>We have a special promotion just for you!</p>
          <div style="background-color: #d5f4e6; border: 2px solid #27ae60; padding: 20px; margin: 20px 0; text-align: center;">
            <h3 style="color: #27ae60; margin: 0;">Limited Time Offer</h3>
            <p style="font-size: 18px; margin: 10px 0;">Save up to 50% on selected services</p>
            <p style="font-size: 14px; color: #666;">Offer expires soon!</p>
          </div>
          <p>Don't miss out on this great opportunity!</p>
          <p>Best regards,<br>The {{company}} Team</p>
        </div>
      `
    },
    abandonedTrademarkOutreach: {
      subject: 'Update: Filing Action Required for {{Mark}}',
      html: `
        <!-- Stylized Legal Header with Background -->
        <div style="font-family: 'Georgia', serif; border-bottom: 2px solid #003366; padding: 20px 0; margin-bottom: 25px; text-align: center; background: linear-gradient(to right, #f7f9fc, #eef2f7);">
          <h1 style="margin: 0; font-size: 24px; color: #003366; letter-spacing: 0.5px;">US Trademark Associates</h1>
          <p style="margin: 5px 0 0 0; font-size: 15px; color: #555; font-style: italic;">Federal Trademark Counsel & Intellectual Property Services</p>
        </div>

        <!-- Email Body -->
        <div style="font-family: 'Times New Roman', serif; color: #000; background: #fff; font-size: 16px; max-width: 700px; margin: 0 auto;">
          <p>Hello {{Name}},</p>
          <br>
          <p>My name is Sean David - Senior Trademark Expert, and I'm reaching out from US Trademark Associates, a firm specializing in trademark protection. I hope you are doing well.</p>
          <br>
          <p>I believe you submitted a trademark application "{{Mark}}" to the USPTO under your ownership, bearing serial number "{{Serial Number}}". However, the application was abandoned because you did not respond to an Office Action issued by the examining attorney.</p>
          <br>
          <p>Separately, we recently received an application from a party in Florida seeking to register "{{Mark}}" as a trademark across all 50 states. Upon searching the federal database, we came across your information and wanted to offer you the opportunity to secure rights before another party does.</p>
          <br>
          <p>Since the USPTO operates on a first-to-file basis, the other applicant may obtain exclusive rights to the name if they complete their registration first. If you're currently using this name for branding, marketing, or promotion, registering the trademark can help protect your rights.</p>
          <br>
          <p>Please let us know within 24 hours if you'd like to secure ownership, and we will connect you with the attorney handling this matter.</p>
          <br>
          <p>Best regards,<br>Sean David<br>US Trademark Associates<br>(760) 813-0012</p>
        </div>

        <!-- Stylized Legal Footer with Background -->
        <div style="font-family: 'Georgia', serif; border-top: 2px solid #003366; padding: 20px 0; margin-top: 35px; font-size: 13px; color: #444; text-align: center; background: linear-gradient(to right, #f7f9fc, #eef2f7);">
          <p style="margin: 0; font-weight: bold; color: #222;">US Trademark Associates</p>
          <p style="margin: 2px 0;">548 Market Street, Suite 69423</p>
          <p style="margin: 2px 0;">San Francisco, CA 94104</p>
          <p style="margin: 2px 0;">Phone: (760) 813-0012</p>
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">If you no longer wish to receive these emails, <a href=\"mailto:support@ustrademarkassociates.com?subject=Unsubscribe\" style=\"color: #003366; text-decoration: underline;\">click here to unsubscribe</a>.</p>
        </div>
      `
    }
  };
};

module.exports = {
  sendBulkEmails,
  testConnection,
  getEmailTemplates
}; 