// Test script for bulk email functionality
require('dotenv').config();
const { sendBulkEmails, testConnection, getEmailTemplates } = require('./bulkEmailSender');

async function testBulkEmail() {
  console.log('🧪 Testing Bulk Email Functionality...\n');

  // Test 1: Connection Test
  console.log('1. Testing SMTP Connection...');
  try {
    const connectionResult = await testConnection();
    console.log('✅ Connection Result:', connectionResult);
  } catch (error) {
    console.log('❌ Connection Failed:', error.message);
    return;
  }

  // Test 2: Get Templates
  console.log('\n2. Testing Template Loading...');
  try {
    const templates = getEmailTemplates();
    console.log('✅ Available Templates:', Object.keys(templates));
  } catch (error) {
    console.log('❌ Template Loading Failed:', error.message);
  }

  // Test 3: Send Test Bulk Email (commented out for safety)
  console.log('\n3. Bulk Email Send Test (SKIPPED - Uncomment to test)');
  console.log('⚠️  Uncomment the code below to test actual email sending');
  
  /*
  const testEmails = [
    'test1@example.com',
    'test2@example.com'
  ];
  
  const testSubject = 'Test Bulk Email from CRM';
  const testHtmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Test Email</h2>
      <p>This is a test email from your CRM bulk email system.</p>
      <p>Sent at: ${new Date().toLocaleString()}</p>
      <p>Best regards,<br>Your CRM System</p>
    </div>
  `;

  try {
    console.log('📧 Sending test emails...');
    const results = await sendBulkEmails(testEmails, testSubject, testHtmlBody, {
      delayMs: 1000 // 1 second delay for testing
    });
    
    console.log('✅ Bulk Email Results:');
    console.log(`- Total: ${results.total}`);
    console.log(`- Successful: ${results.successful.length}`);
    console.log(`- Failed: ${results.failed.length}`);
    console.log(`- Success Rate: ${results.successRate.toFixed(2)}%`);
    console.log(`- Duration: ${results.duration}ms`);
    
    if (results.failed.length > 0) {
      console.log('\n❌ Failed Emails:');
      results.failed.forEach(failed => {
        console.log(`  - ${failed.email}: ${failed.error}`);
      });
    }
  } catch (error) {
    console.log('❌ Bulk Email Test Failed:', error.message);
  }
  */

  console.log('\n🎉 Test completed!');
}

// Run the test
testBulkEmail().catch(console.error); 