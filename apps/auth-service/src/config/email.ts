import { emailService } from '@fx-platform/shared-utils';

export const initializeEmailService = () => {
  const emailConfig = {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
    from: process.env.EMAIL_FROM || 'FX Platform <noreply@fxplatform.com>',
  };

  // Only configure if SMTP settings are provided
  if (emailConfig.host && emailConfig.auth.user && emailConfig.auth.pass) {
    emailService.configure(emailConfig);
    console.log('Email service configured successfully');
  } else {
    console.warn('Email service not configured. Email features will be disabled.');
    console.warn('Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables to enable email.');
  }
};
