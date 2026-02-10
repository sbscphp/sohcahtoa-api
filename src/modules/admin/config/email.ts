import { emailService } from '../../../shared/utils';

export const initializeEmailService = () => {
    const emailConfig = {
        host: process.env.SMTP_HOST || '',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASSWORD || '',
        },
        from: process.env.EMAIL_FROM || 'FX Platform <noreply@fxplatform.com>',
        tls: {
            rejectUnauthorized: false,
        },
        connectionTimeout: 10000,
        debug: true,
        logger: true,
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