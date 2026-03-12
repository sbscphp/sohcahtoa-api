import nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  tls?: any; // Allow passing TLS options like rejectUnauthorized
  connectionTimeout?: number;
  debug?: boolean;
  logger?: boolean;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private config: EmailConfig | null = null;
  private isConfigured = false;

  configure(config: EmailConfig) {
    this.config = config;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
      tls: config.tls,
      connectionTimeout: config.connectionTimeout,
      debug: config.debug,
      logger: config.logger,
    });
    this.isConfigured = true;
  }

  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isConfigured || !this.transporter || !this.config) {
      console.warn('Email service not configured. Email not sent:', options);
      return {
        success: false,
        error: 'Email service not configured',
      };
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.config.from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      console.error('Email sending failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendOtpEmail(email: string, otp: string, purpose: string): Promise<boolean> {
    const subject = this.getOtpSubject(purpose);
    const html = this.getOtpEmailTemplate(otp, purpose);
    const text = `Your OTP is: ${otp}. It will expire in 10 minutes.`;

    const result = await this.sendEmail({
      to: email,
      subject,
      text,
      html,
    });

    return result.success;
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<boolean> {
    const subject = 'Welcome to FX Platform';
    const html = this.getWelcomeEmailTemplate(firstName);
    const text = `Welcome to FX Platform, ${firstName}!`;

    const result = await this.sendEmail({
      to: email,
      subject,
      text,
      html,
    });

    return result.success;
  }

  async sendPasswordCreationEmail(email: string, firstName: string, temporaryPassword: string): Promise<boolean> {
    const subject = 'Complete Your Registration - Create Your Password';
    const html = this.getPasswordCreationTemplate(firstName, temporaryPassword);
    const text = `Welcome ${firstName}! Your temporary password is: ${temporaryPassword}. Please login and change it immediately.`;

    const result = await this.sendEmail({
      to: email,
      subject,
      text,
      html,
    });

    return result.success;
  }

  async sendAdminWelcomeEmail(email: string, fullName: string, resetPasswordUrl: string): Promise<boolean> {
    const subject = 'Welcome to FX Platform';
    const html = this.getAdminWelcomeEmailTemplate(fullName, resetPasswordUrl);
    const text = `Welcome to FX Platform, ${fullName}!`;

    const result = await this.sendEmail({
      to: email,
      subject,
      text,
      html,
    });

    return result.success;
  }

  async sendPasswordResetConfirmationEmail(email: string, firstName?: string): Promise<boolean> {
    const subject = 'Password Reset Successful - FX Platform';
    const html = this.getPasswordResetConfirmationTemplate(firstName || 'User');
    const text = `Your password has been successfully reset. If you did not perform this action, please contact our support team immediately.`;

    const result = await this.sendEmail({
      to: email,
      subject,
      text,
      html,
    });

    return result.success;
  }


  private getOtpSubject(purpose: string): string {
    switch (purpose) {
      case 'REGISTRATION':
        return 'Verify Your Email - FX Platform';
      case 'LOGIN':
        return 'Login Verification Code - FX Platform';
      case 'PASSWORD_RESET':
        return 'Password Reset Code - FX Platform';
      case 'TRANSACTION_VERIFICATION':
        return 'Transaction Verification Code - FX Platform';
      default:
        return 'Verification Code - FX Platform';
    }
  }

  private getOtpEmailTemplate(otp: string, purpose: string): string {
    const purposeText = purpose === 'REGISTRATION'
      ? 'verify your email address'
      : purpose === 'LOGIN'
        ? 'complete your login'
        : purpose === 'PASSWORD_RESET'
          ? 'reset your password'
          : 'verify your transaction';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verification Code</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">FX Platform</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-top: 0;">Verification Code</h2>
            <p>Your verification code to ${purposeText} is:</p>
            <div style="background: white; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0; border: 2px dashed #667eea;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #667eea;">${otp}</span>
            </div>
            <p style="color: #666; font-size: 14px;">This code will expire in <strong>5 minutes</strong>.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">
              FX Platform | Secure Foreign Exchange Transactions
            </p>
          </div>
        </body>
      </html>
    `;
  }

  private getWelcomeEmailTemplate(firstName: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to FX Platform</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Welcome to FX Platform!</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-top: 0;">Hello ${firstName}!</h2>
            <p>Thank you for registering with FX Platform. Your account has been successfully created and verified.</p>
            <p>You can now access all our services including:</p>
            <ul style="color: #666;">
              <li>Secure foreign exchange transactions</li>
              <li>Real-time currency rates</li>
              <li>Transaction history and tracking</li>
              <li>24/7 customer support</li>
            </ul>
            <div style="text-align: center; margin: 30px 0;">
              <a href="#" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Get Started</a>
            </div>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">
              FX Platform | Secure Foreign Exchange Transactions
            </p>
          </div>
        </body>
      </html>
    `;
  }

  private getPasswordCreationTemplate(firstName: string, temporaryPassword: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Complete Your Registration</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Complete Your Registration</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-top: 0;">Hello ${firstName}!</h2>
            <p>Your account has been created successfully. We've generated a temporary password for you.</p>
            <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea;">
              <p style="margin: 0; color: #666;">Temporary Password:</p>
              <p style="font-size: 24px; font-weight: bold; color: #667eea; margin: 10px 0;">${temporaryPassword}</p>
            </div>
            <div style="background: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 20px 0;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                <strong>Important:</strong> Please login and change this password immediately for security reasons.
              </p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="#" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Login Now</a>
            </div>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">
              FX Platform | Secure Foreign Exchange Transactions
            </p>
          </div>
        </body>
      </html>
    `;
  }

  private getAdminWelcomeEmailTemplate(fullName: string, resetPasswordUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to FX Platform</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Welcome to FX Platform</h1>
          </div>

          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-top: 0;">Hello ${fullName},</h2>

            <p>
              Welcome to <strong>FX Platform</strong>. Your admin account has been successfully created.
            </p>

            <p>
              To get started, please set your password by clicking the button below.
              This link is secure and will expire for your protection.
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a
                href="${resetPasswordUrl}"
                style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;"
                target="_blank"
                rel="noopener noreferrer"
              >
                Set Your Password
              </a>
            </div>

            <p style="color: #666;">
              If you did not request this account or believe this email was sent in error,
              please ignore it or contact our support team immediately.
            </p>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

            <p style="color: #999; font-size: 12px; text-align: center;">
              FX Platform | Secure Foreign Exchange Transactions
            </p>
          </div>
        </body>
      </html>
    `;
  }

  private getPasswordResetConfirmationTemplate(firstName: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset Successful</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Password Reset Successful</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-top: 0;">Hello ${firstName}!</h2>
            <p>Your password has been successfully reset.</p>
            <div style="background: #d4edda; padding: 15px; border-radius: 5px; border-left: 4px solid #28a745; margin: 20px 0;">
              <p style="margin: 0; color: #155724; font-size: 14px;">
                <strong>✓ Success:</strong> You can now log in with your new password.
              </p>
            </div>
            <p>For your security, all active sessions have been logged out. You'll need to log in again with your new password.</p>
            <div style="background: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 20px 0;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                <strong>Security Notice:</strong> If you did not perform this password reset, please contact our support team immediately. Your account may be compromised.
              </p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="#" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Login Now</a>
            </div>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">
              FX Platform | Secure Foreign Exchange Transactions
            </p>
          </div>
        </body>
      </html>
    `;
  }


  isReady(): boolean {
    return this.isConfigured;
  }
}

export const emailService = new EmailService();
