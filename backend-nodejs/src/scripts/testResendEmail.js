import emailService from '../services/emailService.js';

async function testEmailSending() {
  console.log('📧 Testing email service setup...');
  
  const targetEmail = process.env.SMTP_FROM_EMAIL || 'blackholeinfiverse90@gmail.com';

  const result = await emailService.sendMail({
    to: targetEmail,
    subject: '🔔 BHIV SETU Test Email',
    html: `
      <h2>✅ Email Service Connected!</h2>
      <p>This is a test notification from your <strong>BHIV SETU Logistics System</strong>.</p>
      <p>Sent at: <strong>${new Date().toLocaleString()}</strong></p>
    `
  });

  if (result.success) {
    console.log('🎉 SUCCESS! Test email was sent cleanly.');
    console.log('Message ID:', result.messageId);
  } else {
    console.error('❌ FAILED to send test email:', result.message);
  }
}

testEmailSending();
