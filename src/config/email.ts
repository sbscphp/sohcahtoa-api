import nodemailer, { Transporter } from 'nodemailer';
import { createLogger } from '../shared/utils/logger';
import { emailService } from '../shared/utils/email';

const logger = createLogger('Email');

let transporter: Transporter | null = null;

export const initializeEmail = (): Transporter | null => {
  try {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const smtpFromEmail = process.env.SMTP_FROM_EMAIL;
    const smtpFromName = process.env.SMTP_FROM_NAME || 'Sochatoa API';
    const smtpSecureEnv = process.env.SMTP_SECURE;
    const smtpSecure = smtpSecureEnv !== undefined ? smtpSecureEnv === 'true' : smtpPort === 465;
    // const smtpTimeout = parseInt(process.env.SMTP_TIMEOUT || '10000', 10);
    const smtpDebug = process.env.SMTP_DEBUG === 'true';
    const smtpLogger = process.env.SMTP_LOGGER === 'true';
    const smtpAllowInsecureTls = process.env.SMTP_TLS_INSECURE === 'true';

    // If SMTP is not configured, use fallback (console logging in development)
    if (!smtpHost || !smtpUser || !smtpPassword) {
      logger.warn('SMTP not configured. Email sending will be disabled.');

      // In development, create a test account
      if (process.env.NODE_ENV === 'development') {
        logger.info('Creating ethereal email test account for development...');
        // Note: This is async, but we'll handle it in the actual email sending
      }

      return null;
    }

    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      from: {
        name: smtpFromName,
        address: smtpFromEmail || smtpUser,
      },
      tls: smtpAllowInsecureTls ? { rejectUnauthorized: false } : undefined,
      // connectionTimeout: smtpTimeout,
      debug: smtpDebug,
      logger: smtpLogger,
    });

    // Configure shared emailService for modules that rely on it
    emailService.configure({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPassword },
      from: `${smtpFromName} <${smtpFromEmail || smtpUser}>`,
      tls: smtpAllowInsecureTls ? { rejectUnauthorized: false } : undefined,
      // connectionTimeout: smtpTimeout,
      debug: smtpDebug,
      logger: smtpLogger,
    });

    // Verify connection
    transporter.verify((error) => {
      if (error) {
        logger.error('SMTP connection verification failed:', error);
      } else {
        logger.info('Email service initialized successfully');
      }
    });

    return transporter;
  } catch (error) {
    logger.error('Failed to initialize email service:', error);
    return null;
  }
};

export const getEmailTransporter = (): Transporter | null => {
  if (!transporter) {
    return initializeEmail();
  }
  return transporter;
};

/**
 * Send an email
 */
export const sendEmail = async (options: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}): Promise<boolean> => {
  try {
    const transport = getEmailTransporter();

    if (!transport) {
      logger.warn('Email transporter not available. Email not sent:', {
        to: options.to,
        subject: options.subject,
      });

      // Log the email in development
      if (process.env.NODE_ENV === 'development') {
        logger.info('DEV MODE - Email would have been sent:', {
          to: options.to,
          subject: options.subject,
          text: options.text,
        });
      }

      return false;
    }

    const result = await transport.sendMail({
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    logger.info('Email sent successfully:', {
      to: options.to,
      subject: options.subject,
      messageId: result.messageId,
    });

    return true;
  } catch (error) {
    logger.error('Failed to send email:', error);
    return false;
  }
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
