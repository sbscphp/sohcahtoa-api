import nodemailer from 'nodemailer';
import { emailClient } from '../../integrations/sms-gateway/email.client';

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
  tls?: any;
  connectionTimeout?: number;
  debug?: boolean;
  logger?: boolean;
}

// ─── Termii Template IDs ───────────────────────────────────────────────────
// Configure each template in the Termii dashboard, then copy its ID to .env.
// Variable placeholders used per template are listed in the comments below.
const TEMPLATES = {
  // Variables: {{otp}}, {{purpose_text}}
  otp:                    process.env.TERMII_TEMPLATE_ID_OTP                     || '',
  // Variables: {{first_name}}
  welcome:                process.env.TERMII_TEMPLATE_ID_WELCOME                 || '',
  // Variables: {{full_name}}, {{otp}}
  agentWelcome:           process.env.TERMII_TEMPLATE_ID_AGENT_WELCOME           || '',
  // Variables: {{full_name}}, {{reset_password_url}}
  adminWelcome:           process.env.TERMII_TEMPLATE_ID_ADMIN_WELCOME           || '',
  // Variables: {{first_name}}
  passwordResetConfirm:   process.env.TERMII_TEMPLATE_ID_PASSWORD_RESET_CONFIRM  || '',
  // Variables: {{first_name}}, {{temporary_password}}
  passwordCreation:       process.env.TERMII_TEMPLATE_ID_PASSWORD_CREATION       || '',
  // Variables: {{first_name}}, {{transaction_ref}}, {{amount}}
  transactionApproved:    process.env.TERMII_TEMPLATE_ID_TRANSACTION_APPROVED    || '',
  // Variables: {{first_name}}, {{transaction_ref}}, {{reason}}
  transactionRejected:    process.env.TERMII_TEMPLATE_ID_TRANSACTION_REJECTED    || '',
  // Variables: {{first_name}}, {{transaction_ref}}, {{amount}}, {{currency}}
  transactionCompleted:   process.env.TERMII_TEMPLATE_ID_TRANSACTION_COMPLETED   || '',
  // Variables: {{first_name}}, {{transaction_ref}}, {{amount}}
  depositConfirmed:       process.env.TERMII_TEMPLATE_ID_DEPOSIT_CONFIRMED       || '',
  // Variables: {{first_name}}
  kycApproved:            process.env.TERMII_TEMPLATE_ID_KYC_APPROVED            || '',
  // Variables: {{first_name}}, {{reason}}
  kycRejected:            process.env.TERMII_TEMPLATE_ID_KYC_REJECTED            || '',
  // Variables: {{first_name}}, {{reason}}
  accountSuspended:       process.env.TERMII_TEMPLATE_ID_ACCOUNT_SUSPENDED       || '',
  // Variables: {{first_name}}
  accountActivated:       process.env.TERMII_TEMPLATE_ID_ACCOUNT_ACTIVATED       || '',
  // Variables: {{first_name}}, {{transaction_ref}}, {{info}}
  additionalInfoRequired: process.env.TERMII_TEMPLATE_ID_ADDITIONAL_INFO_REQUIRED || '',
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function otpPurposeText(purpose: string): string {
  switch (purpose) {
    case 'REGISTRATION':           return 'verify your email address';
    case 'LOGIN':                  return 'complete your login';
    case 'PASSWORD_RESET':         return 'reset your password';
    case 'TRANSACTION_VERIFICATION': return 'verify your transaction';
    case 'AGENT_SET_PASSWORD':     return 'set your agent password';
    default:                       return 'complete your request';
  }
}

function otpSubject(purpose: string): string {
  switch (purpose) {
    case 'REGISTRATION':           return 'Verify Your Email - Sochatoa';
    case 'LOGIN':                  return 'Login Verification Code - Sochatoa';
    case 'PASSWORD_RESET':         return 'Password Reset Code - Sochatoa';
    case 'TRANSACTION_VERIFICATION': return 'Transaction Verification Code - Sochatoa';
    case 'AGENT_SET_PASSWORD':     return 'Complete Your Agent Setup - Sochatoa';
    default:                       return 'Verification Code - Sochatoa';
  }
}

// ─── EmailService ─────────────────────────────────────────────────────────

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private config: EmailConfig | null = null;
  private isConfigured = false;
  private useTermii = process.env.EMAIL_PROVIDER === 'termii';

  configure(config: EmailConfig) {
    this.config = config;
    this.transporter = nodemailer.createTransport({
      host:              config.host,
      port:              config.port,
      secure:            config.secure,
      auth:              config.auth,
      tls:               config.tls,
      connectionTimeout: config.connectionTimeout,
      debug:             config.debug,
      logger:            config.logger,
    });
    this.isConfigured = true;
  }

  // ── Generic send (used for SMTP fallback path) ──────────────────────────

  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (this.useTermii) {
      // No plain-email endpoint in Termii — callers should use sendTemplate methods instead.
      console.warn('Plain email called with Termii provider — use template methods. Email not sent.');
      return { success: false, error: 'Use sendTemplate methods for Termii email delivery' };
    }

    if (!this.isConfigured || !this.transporter || !this.config) {
      console.warn('Email service not configured. Email not sent:', options);
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const info = await this.transporter.sendMail({
        from:    this.config.from,
        to:      options.to,
        subject: options.subject,
        text:    options.text,
        html:    options.html,
      });
      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      console.error('Email sending failed:', error);
      return { success: false, error: error.message };
    }
  }

  // ── Template send helper (Termii only) ──────────────────────────────────

  private async sendTemplate(
    to: string,
    templateKey: keyof typeof TEMPLATES,
    data: Record<string, string | number>,
    // SMTP fallback: subject + plain text for when Termii is not used
    fallback: { subject: string; text: string; html?: string }
  ): Promise<boolean> {
    if (this.useTermii) {
      const templateId = TEMPLATES[templateKey];
      if (!templateId) {
        console.warn(`Termii template ID not configured for "${templateKey}". Email not sent.`);
        return false;
      }
      try {
        const result = await emailClient.sendTemplateEmail(to, templateId, data, fallback.subject);
        return result.success;
      } catch (error: any) {
        console.error(`Termii template email failed (${templateKey}):`, error);
        return false;
      }
    }

    const result = await this.sendEmail({ to, ...fallback });
    return result.success;
  }

  // ── OTP email ────────────────────────────────────────────────────────────

  async sendOtpEmail(email: string, otp: string, purpose: string): Promise<boolean> {
    if (this.useTermii) {
      try {
        // Use Termii's dedicated OTP endpoint if template ID is not configured,
        // otherwise use the template (allows custom branding)
        if (TEMPLATES.otp) {
          const result = await emailClient.sendTemplateEmail(
            email,
            TEMPLATES.otp,
            { otp, purpose_text: otpPurposeText(purpose), expiry_minutes: 5 },
            otpSubject(purpose),
          );
          return result.success;
        }
        const result = await emailClient.sendOtpEmail(email, otp);
        return result.success;
      } catch (error: any) {
        console.error('Termii OTP email failed:', error);
        return false;
      }
    }

    return this.sendTemplate(email, 'otp', { otp, purpose_text: otpPurposeText(purpose), expiry_minutes: 5 }, {
      subject: otpSubject(purpose),
      text: `Your verification code is: ${otp}. It will expire in 5 minutes.`,
    });
  }

  // ── Welcome email (customer) ─────────────────────────────────────────────

  async sendWelcomeEmail(email: string, firstName: string): Promise<boolean> {
    return this.sendTemplate(email, 'welcome', { first_name: firstName }, {
      subject: 'Welcome to Sochatoa',
      text: `Welcome to Sochatoa, ${firstName}! Your account has been successfully created and verified.`,
    });
  }

  // ── Agent welcome email ──────────────────────────────────────────────────

  async sendAgentWelcomeEmail(email: string, fullName: string, otp: string): Promise<boolean> {
    return this.sendTemplate(email, 'agentWelcome', { full_name: fullName, otp }, {
      subject: 'Welcome to Sochatoa - Complete Your Agent Setup',
      text: `Welcome to Sochatoa, ${fullName}! Your agent account has been created. Your verification code to set your password is: ${otp}. This code expires in 5 minutes.`,
    });
  }

  // ── Admin welcome email ──────────────────────────────────────────────────

  async sendAdminWelcomeEmail(email: string, fullName: string, resetPasswordUrl: string): Promise<boolean> {
    return this.sendTemplate(email, 'adminWelcome', { full_name: fullName, reset_password_url: resetPasswordUrl }, {
      subject: 'Welcome to Sochatoa Admin Portal',
      text: `Welcome to Sochatoa, ${fullName}! Your admin account has been created. Set your password here: ${resetPasswordUrl}`,
    });
  }

  // ── Password reset confirmation ──────────────────────────────────────────

  async sendPasswordResetConfirmationEmail(email: string, firstName?: string): Promise<boolean> {
    return this.sendTemplate(email, 'passwordResetConfirm', { first_name: firstName || 'User' }, {
      subject: 'Password Reset Successful - Sochatoa',
      text: `Hi ${firstName || 'User'}, your password has been successfully reset. If you did not perform this action, please contact support immediately.`,
    });
  }

  // ── Password creation (temp password) ───────────────────────────────────

  async sendPasswordCreationEmail(email: string, firstName: string, temporaryPassword: string): Promise<boolean> {
    return this.sendTemplate(email, 'passwordCreation', { first_name: firstName, temporary_password: temporaryPassword }, {
      subject: 'Complete Your Registration - Create Your Password',
      text: `Welcome ${firstName}! Your temporary password is: ${temporaryPassword}. Please login and change it immediately.`,
    });
  }

  // ── Transaction approved ─────────────────────────────────────────────────

  async sendTransactionApprovedEmail(email: string, firstName: string, transactionRef: string, amount: string): Promise<boolean> {
    return this.sendTemplate(email, 'transactionApproved', { first_name: firstName, transaction_ref: transactionRef, amount }, {
      subject: `Transaction Approved - ${transactionRef}`,
      text: `Hi ${firstName}, your transaction ${transactionRef} for ${amount} has been approved and is being processed.`,
    });
  }

  // ── Transaction rejected ─────────────────────────────────────────────────

  async sendTransactionRejectedEmail(email: string, firstName: string, transactionRef: string, reason: string): Promise<boolean> {
    return this.sendTemplate(email, 'transactionRejected', { first_name: firstName, transaction_ref: transactionRef, reason }, {
      subject: `Transaction Update - ${transactionRef}`,
      text: `Hi ${firstName}, your transaction ${transactionRef} could not be approved. Reason: ${reason}. Please contact support if you need assistance.`,
    });
  }

  // ── Transaction completed / payment receipt ───────────────────────────────

  async sendTransactionCompletedEmail(email: string, firstName: string, transactionRef: string, amount: string, currency: string): Promise<boolean> {
    return this.sendTemplate(email, 'transactionCompleted', { first_name: firstName, transaction_ref: transactionRef, amount, currency }, {
      subject: `Payment Receipt - ${transactionRef}`,
      text: `Hi ${firstName}, your transaction ${transactionRef} is complete. ${amount} ${currency} has been disbursed to you.`,
    });
  }

  // ── Deposit confirmed ─────────────────────────────────────────────────────

  async sendDepositConfirmedEmail(email: string, firstName: string, transactionRef: string, amount: string): Promise<boolean> {
    return this.sendTemplate(email, 'depositConfirmed', { first_name: firstName, transaction_ref: transactionRef, amount }, {
      subject: `Deposit Confirmed - ${transactionRef}`,
      text: `Hi ${firstName}, we've confirmed your deposit of ${amount} for transaction ${transactionRef}. Your transaction is now being processed.`,
    });
  }

  // ── KYC approved ─────────────────────────────────────────────────────────

  async sendKycApprovedEmail(email: string, firstName: string): Promise<boolean> {
    return this.sendTemplate(email, 'kycApproved', { first_name: firstName }, {
      subject: 'Identity Verified - Sochatoa',
      text: `Hi ${firstName}, congratulations! Your identity has been verified and your Sochatoa account is now fully active.`,
    });
  }

  // ── KYC rejected ─────────────────────────────────────────────────────────

  async sendKycRejectedEmail(email: string, firstName: string, reason: string): Promise<boolean> {
    return this.sendTemplate(email, 'kycRejected', { first_name: firstName, reason }, {
      subject: 'Verification Unsuccessful - Sochatoa',
      text: `Hi ${firstName}, we were unable to verify your identity. Reason: ${reason}. Please resubmit your documents or contact support.`,
    });
  }

  // ── Account suspended ─────────────────────────────────────────────────────

  async sendAccountSuspendedEmail(email: string, firstName: string, reason: string): Promise<boolean> {
    return this.sendTemplate(email, 'accountSuspended', { first_name: firstName, reason }, {
      subject: 'Account Suspended - Sochatoa',
      text: `Hi ${firstName}, your Sochatoa account has been temporarily suspended. Reason: ${reason}. Contact support if you believe this is an error.`,
    });
  }

  // ── Account activated ─────────────────────────────────────────────────────

  async sendAccountActivatedEmail(email: string, firstName: string): Promise<boolean> {
    return this.sendTemplate(email, 'accountActivated', { first_name: firstName }, {
      subject: 'Account Reactivated - Sochatoa',
      text: `Hi ${firstName}, your Sochatoa account has been reactivated. You now have full access to all features.`,
    });
  }

  // ── Additional Information Required ───────────────────────────────────────

  async sendAdditionalInfoRequiredEmail(email: string, firstName: string, transactionRef: string, info: string): Promise<boolean> {
    return this.sendTemplate(email, 'additionalInfoRequired', { first_name: firstName, transaction_ref: transactionRef, info }, {
      subject: `Additional Information Required - ${transactionRef}`,
      text: `Hi ${firstName}, your transaction ${transactionRef} requires additional information: ${info}. Please provide it to complete the transaction review.`,
    });
  }

  isReady(): boolean {
    return this.isConfigured || this.useTermii;
  }
}

export const emailService = new EmailService();
