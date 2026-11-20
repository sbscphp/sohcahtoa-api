import { createLogger } from '../shared/utils/logger';
import { emailService } from '../shared/utils/email';

const logger = createLogger('Email');

/**
 * Email is delivered exclusively through Termii (see EmailService). SMTP/Gmail is disabled.
 */
export const initializeEmail = (): null => {
  logger.info('Email delivery uses Termii only (SMTP disabled)');
  return null;
};

/**
 * Send an email (via Termii generic template)
 */
export const sendEmail = async (options: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}): Promise<boolean> => {
  const result = await emailService.sendEmail(options);
  if (!result.success) {
    logger.warn('Email not sent', { to: options.to, subject: options.subject, error: result.error });
  }
  return result.success;
};

/**
 * Send a templated email (can be extended with a template engine)
 */
export const sendTemplatedEmail = async (
  to: string,
  template: string,
  data: Record<string, any>
): Promise<boolean> => {
  // Basic template rendering (can be replaced with a proper template engine)
  const templates: Record<string, { subject: string; html: (data: any) => string }> = {
    welcome: {
      subject: 'Welcome to Sochatoa API',
      html: (data) => `
        <h1>Welcome ${data.firstName}!</h1>
        <p>Thank you for registering with Sochatoa API.</p>
        <p>Your account has been created successfully.</p>
      `,
    },
    otp: {
      subject: 'Your OTP Code',
      html: (data) => `
        <h1>Your OTP Code</h1>
        <p>Your one-time password is: <strong>${data.otp}</strong></p>
        <p>This code will expire in ${data.expiryMinutes || 10} minutes.</p>
      `,
    },
    passwordReset: {
      subject: 'Password Reset Request',
      html: (data) => `
        <h1>Password Reset</h1>
        <p>You have requested to reset your password.</p>
        <p>Your reset code is: <strong>${data.resetCode}</strong></p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    },
    transactionCreated: {
      subject: 'Transaction Created',
      html: (data) => `
        <h1>Transaction Created</h1>
        <p>Your transaction ${data.referenceNumber} has been created.</p>
        <p>Amount: ${data.amount} ${data.currency}</p>
        <p>Status: ${data.status}</p>
      `,
    },
    transactionApproved: {
      subject: 'Transaction Approved',
      html: (data) => `
        <h1>Transaction Approved</h1>
        <p>Your transaction ${data.referenceNumber} has been approved.</p>
        <p>Amount: ${data.amount} ${data.currency}</p>
      `,
    },
  };

  const templateConfig = templates[template];
  if (!templateConfig) {
    logger.error(`Template not found: ${template}`);
    return false;
  }

  return await sendEmail({
    to,
    subject: templateConfig.subject,
    html: templateConfig.html(data),
  });
};
