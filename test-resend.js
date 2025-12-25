// Test script to verify Resend email sending
// Run with: node test-resend.js

const RESEND_API_KEY = 're_a51eMJTw_8V1oskUpkjc8SdkQFcu3hsFY'; // Your API key
const ALERT_EMAIL = 'alioui@hotmail.it'; // Your email

async function testResendEmail() {
  console.log('🧪 Testing Resend email API...\n');
  console.log('API Key:', RESEND_API_KEY.slice(0, 10) + '...');
  console.log('To:', ALERT_EMAIL);
  console.log('');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'WARFOG.IO Security <onboarding@resend.dev>',
        to: [ALERT_EMAIL],
        subject: '🧪 TEST: Warfog.io Alert System',
        text: `This is a test email from your Warfog.io alert system.

If you receive this, your email notifications are working correctly!

Test sent at: ${new Date().toISOString()}`
      })
    });

    const responseText = await response.text();
    console.log('Response status:', response.status);
    console.log('Response body:', responseText);
    console.log('');

    if (response.ok) {
      console.log('✅ SUCCESS! Email sent successfully.');
      console.log('Check your inbox at:', ALERT_EMAIL);
      console.log('(Also check spam folder)');
    } else {
      console.log('❌ FAILED! Response was not OK');
      console.log('');
      console.log('Possible issues:');
      console.log('- API key is invalid or expired');
      console.log('- Email address is invalid');
      console.log('- Resend account not verified');
    }
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('');
    console.error('Possible issues:');
    console.error('- No internet connection');
    console.error('- Fetch API not available (use Node.js 18+)');
  }
}

testResendEmail();
