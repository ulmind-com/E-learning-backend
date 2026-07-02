import nodemailer from 'nodemailer';

export const sendEmail = async ({ to, subject, html }) => {
  try {
    // If SMTP credentials are not present, log the email to the console for development testing
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('\n=============================================');
      console.log('MOCK EMAIL SENT (No SMTP Credentials Found)');
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log('Body:');
      console.log(html);
      console.log('=============================================\n');
      return true;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail', // You can change this to your preferred provider
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"E-Learning Platform" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};
