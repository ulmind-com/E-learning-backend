export const sendEmail = async ({ to, subject, html }) => {
  try {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@e-learning.com';

    // Fallback for local development if keys are missing
    if (!apiKey) {
      console.log('\n=============================================');
      console.log('MOCK EMAIL SENT (No Brevo API Key Found)');
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log('Body:');
      console.log(html);
      console.log('=============================================\n');
      return true;
    }

    const payload = {
      sender: {
        name: "E-Learning Platform",
        email: senderEmail
      },
      to: [
        {
          email: to
        }
      ],
      subject: subject,
      htmlContent: html
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Brevo API Error:', errorData);
      return false;
    }

    const data = await response.json();
    console.log('Email sent successfully via Brevo, messageId:', data.messageId);
    return true;

  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};
