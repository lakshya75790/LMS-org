const nodemailer = require('nodemailer');

// Create reusable Nodemailer transporter using environment variables only
const createTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!user || !pass) {
    console.warn('[Email Service] Warning: Email credentials (SMTP_USER/EMAIL_USER and SMTP_PASS/EMAIL_PASS) are not configured in .env.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
    tls: {
      rejectUnauthorized: false
    }
  });
};

/**
 * Send Password Reset OTP Email
 * @param {string} toEmail - Recipient email
 * @param {string} otp - 6-digit OTP code
 * @param {string} userName - Optional user name
 */
const sendPasswordResetOTPEmail = async (toEmail, otp, userName = 'User') => {
  try {
    const transporter = createTransporter();
    const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER || 'no-reply@lms-platform.com';

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset OTP - LMS</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1e293b;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); overflow: hidden;">
              <!-- Header -->
              <tr>
                <td style="padding: 32px 32px 24px 32px; background: linear-gradient(135deg, #059669 0%, #047857 100%); text-align: center;">
                  <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; tracking-tight: -0.02em;">LMS Platform</h1>
                  <p style="margin: 6px 0 0 0; font-size: 13px; color: #a7f3d0; font-weight: 500;">Learning Management System</p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding: 32px;">
                  <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #0f172a;">Password Reset Request</h2>
                  <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                    Hello ${userName},<br>
                    We received a request to reset the password for your LMS account. Use the verification code below to proceed with setting your new password.
                  </p>

                  <!-- OTP Box -->
                  <div style="background-color: #f0fdf4; border: 1px dashed #059669; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
                    <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #047857; display: block; margin-bottom: 8px;">Your 6-Digit Verification Code</span>
                    <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #047857; display: inline-block; padding-left: 8px;">${otp}</span>
                  </div>

                  <!-- Expiry Notice -->
                  <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin-bottom: 24px;">
                    <p style="margin: 0; font-size: 13px; color: #92400e; font-weight: 500;">
                      ⏰ This code will expire in <strong>5 minutes</strong>. If you did not request a password reset, please ignore this email or contact your administrator.
                    </p>
                  </div>

                  <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                    For security reasons, never share this verification code with anyone.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                    This is an automated system notification from your Learning Management System.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: 'Password Reset Verification Code - LMS',
      html: htmlContent
    });

    console.log(`[Email Service] Password reset OTP sent to ${toEmail}. Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[Email Service] Failed to send OTP email to ${toEmail}:`, error.message);
    // Don't throw fatal error to caller, handle gracefully
    return false;
  }
};

module.exports = {
  sendPasswordResetOTPEmail
};
