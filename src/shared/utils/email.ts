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
  // OTP templates — Variables: shared + otp_digit_1…otp_digit_6, expiry_minutes
  verifyEmailOtp:            process.env.TERMII_TEMPLATE_ID_VERIFY_EMAIL_OTP            || '',
  resetPasswordOtp:          process.env.TERMII_TEMPLATE_ID_RESET_PASSWORD_OTP          || '',

  // Agent / Admin onboarding
  // Variables: shared + full_name, otp, set_password_url
  agentWelcome:              process.env.TERMII_TEMPLATE_ID_AGENT_WELCOME               || '',
  // Variables: shared + full_name, reset_password_url
  adminWelcome:              process.env.TERMII_TEMPLATE_ID_ADMIN_WELCOME               || '',
  // Variables: shared + branch_name, branch_manager, state, address, phone_number, branch_email
  branchCreated:             process.env.TERMII_TEMPLATE_ID_BRANCH_CREATED              || '',
  // Variables: shared
  passwordResetConfirm:      process.env.TERMII_TEMPLATE_ID_PASSWORD_RESET_CONFIRM      || '',
  // Variables: shared + temporary_password
  passwordCreation:          process.env.TERMII_TEMPLATE_ID_PASSWORD_CREATION           || '',
  // Variables: shared
  welcome:                   process.env.TERMII_TEMPLATE_ID_WELCOME                     || '',

  // KYC / account state
  // Variables: shared
  kycApproved:               process.env.TERMII_TEMPLATE_ID_KYC_APPROVED                || '',
  // Variables: shared + reason
  kycRejected:               process.env.TERMII_TEMPLATE_ID_KYC_REJECTED                || '',
  // Variables: shared + reason
  accountSuspended:          process.env.TERMII_TEMPLATE_ID_ACCOUNT_SUSPENDED           || '',
  // Variables: shared
  accountActivated:          process.env.TERMII_TEMPLATE_ID_ACCOUNT_ACTIVATED           || '',

  // Document review
  // Variables: shared + transaction_ref, info
  additionalInfoRequired:    process.env.TERMII_TEMPLATE_ID_ADDITIONAL_INFO_REQUIRED    || '',
  // Variables: shared + transaction_ref, document_type
  documentApproved:          process.env.TERMII_TEMPLATE_ID_DOCUMENT_APPROVED           || '',
  // Variables: shared + transaction_ref, document_type, reason
  documentRejected:          process.env.TERMII_TEMPLATE_ID_DOCUMENT_REJECTED           || '',

  // Transaction state
  // Variables: shared + transaction_ref, amount, transaction_url
  transactionApproved:       process.env.TERMII_TEMPLATE_ID_TRANSACTION_APPROVED        || '',
  // Variables: shared + transaction_ref, reason
  transactionRejected:       process.env.TERMII_TEMPLATE_ID_TRANSACTION_REJECTED        || '',
  // Variables: shared + transaction_ref, amount, transaction_url
  depositConfirmed:          process.env.TERMII_TEMPLATE_ID_DEPOSIT_CONFIRMED           || '',

  // Settled / completed — one template per transaction type
  // Variables: shared + transaction_id, amount_display, bank_name, account_number, branch_name, street_address, city_state, receipt_url
  ptaFundsRemitted:          process.env.TERMII_TEMPLATE_ID_PTA_FUNDS_REMITTED          || '',
  btaFundsRemitted:          process.env.TERMII_TEMPLATE_ID_BTA_FUNDS_REMITTED          || '',
  // Variables: shared + transaction_id, amount_display, beneficiary_name, beneficiary_account, disbursement_date, receipt_url
  schoolFeeDisbursed:        process.env.TERMII_TEMPLATE_ID_SCHOOL_FEE_DISBURSED        || '',
  medicalFeeDisbursed:       process.env.TERMII_TEMPLATE_ID_MEDICAL_FEE_DISBURSED       || '',
  professionalBodyDisbursed: process.env.TERMII_TEMPLATE_ID_PROFESSIONAL_BODY_DISBURSED || '',
  // Variables: shared + transaction_id, branch_name, street_address, city_state, pickup_date, receipt_url
  touristCardPickup:         process.env.TERMII_TEMPLATE_ID_TOURIST_CARD_PICKUP         || '',
  // Variables: shared + transaction_id, transaction_type_label, refund_amount_display, provide_bank_details_url
  refundBankDetailsRequest:  process.env.TERMII_TEMPLATE_ID_REFUND_BANK_DETAILS_REQUEST || '',
  // Variables: shared + transaction_ref, reason, severity, amount, customer_name
  flaggedTransactionEscalated: process.env.TERMII_TEMPLATE_ID_FLAGGED_TRANSACTION_ESCALATED || '',
  // Admin notification sent when a customer initiates a new transaction.
  // Variables: shared + transaction_ref, customer_name, transaction_type, amount
  transactionInitiatedAdmin: process.env.TERMII_TEMPLATE_ID_TRANSACTION_INITIATED_ADMIN || '',
  // Reusable admin notification for transaction lifecycle activity (Approved/Rejected/Cancelled/Updated/Flagged).
  // Variables: shared + activity_type, transaction_ref, customer_name, transaction_type, amount, performed_by
  transactionActivityAdmin: process.env.TERMII_TEMPLATE_ID_TRANSACTION_ACTIVITY_ADMIN || '',
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function otpSubject(purpose: string): string {
  switch (purpose) {
    case 'REGISTRATION':             return 'Verify Your Email - SohCahToa';
    case 'LOGIN':                    return 'Login Verification Code - SohCahToa';
    case 'PASSWORD_RESET':           return 'Reset Your SohCahToa Password';
    case 'CHANGE_PASSWORD':          return 'Password Change Verification - SohCahToa';
    case 'TRANSACTION_VERIFICATION': return 'Transaction Verification Code - SohCahToa';
    case 'AGENT_SET_PASSWORD':       return 'Complete Your Agent Setup - SohCahToa';
    default:                         return 'Verification Code - SohCahToa';
  }
}

/** Split a 6-digit OTP into individual digit variables for Termii templates. */
function splitOtpDigits(otp: string): Record<string, string> {
  const digits = otp.padStart(6, '0').split('');
  return {
    otp_digit_1: digits[0],
    otp_digit_2: digits[1],
    otp_digit_3: digits[2],
    otp_digit_4: digits[3],
    otp_digit_5: digits[4],
    otp_digit_6: digits[5],
  };
}

/**
 * Variables injected into every template.
 * All templates must have these placeholders so they render correctly.
 */
function sharedVars(email: string, firstName: string): Record<string, string> {
  const appUrl = process.env.APP_URL || '';
  return {
    first_name:         firstName,
    recipient_email:    email,
    company_name:       'SohCahToa Holdings',
    company_address:    'Lagos State, Nigeria',
    current_year:       new Date().getFullYear().toString(),
    app_url:            appUrl,
    support_email:      process.env.SUPPORT_EMAIL        || 'support@sohcahtoabdc.com',
    support_phone:      process.env.SUPPORT_PHONE        || '+234XXXXXXXXXX',
    support_agent_name: process.env.SUPPORT_AGENT_NAME   || 'Support Team',
    unsubscribe_url:    `${appUrl}/unsubscribe`,
    preferences_url:    `${appUrl}/settings/notifications`,
    login_url:          `${appUrl}/login`,
    dashboard_url:      `${appUrl}/dashboard`,
    kyc_url:            `${appUrl}/kyc`,
    x_url:              process.env.SOCIAL_X_URL         || 'https://x.com/sohcahtoa',
    facebook_url:       process.env.SOCIAL_FACEBOOK_URL  || 'https://facebook.com/sohcahtoa',
    instagram_url:      process.env.SOCIAL_INSTAGRAM_URL || 'https://instagram.com/sohcahtoa',
  };
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
    fallback: { subject: string; text: string; html?: string }
  ): Promise<boolean> {
    if (this.useTermii) {
      const templateId = TEMPLATES[templateKey];
      if (templateId) {
        try {
          const result = await emailClient.sendTemplateEmail(to, templateId, data, fallback.subject);
          if (result.success) {
            return true;
          }
          console.warn(`Termii template email returned non-success (${templateKey}) for ${to}, falling back to standard email`);
        } catch (error: any) {
          console.warn(`Termii template email failed (${templateKey}) for ${to}, falling back to standard email:`, error?.response?.data || error?.message || error);
        }
      } else {
        console.info(`Termii template ID not configured for "${templateKey}", using standard email transport.`);
      }
    }

    const result = await this.sendEmail({ to, ...fallback });
    return result.success;
  }

  // ── OTP email ────────────────────────────────────────────────────────────

  async sendOtpEmail(email: string, otp: string, purpose: string, firstName: string = 'User'): Promise<boolean> {
    const subject = otpSubject(purpose);
    const digits = splitOtpDigits(otp);
    const shared = sharedVars(email, firstName);

    if (this.useTermii) {
      try {
        const isPasswordReset  = purpose === 'PASSWORD_RESET';
        const isChangePassword = purpose === 'CHANGE_PASSWORD';
        const templateKey: keyof typeof TEMPLATES =
          isPasswordReset  ? 'resetPasswordOtp' :
          isChangePassword ? 'verifyEmailOtp'   :   // change-password-otp shares verifyEmailOtp key
                             'verifyEmailOtp';
        const templateId = TEMPLATES[templateKey];

        if (templateId) {
          const result = await emailClient.sendTemplateEmail(
            email,
            templateId,
            { ...shared, ...digits, expiry_minutes: '5' },
            subject,
          );
          return result.success;
        }

        // Fallback to raw OTP endpoint if template ID not yet configured
        const result = await emailClient.sendOtpEmail(email, otp);
        return result.success;
      } catch (error: any) {
        console.error('Termii OTP email failed:', error);
        return false;
      }
    }

    return this.sendTemplate(email, 'verifyEmailOtp', { ...shared, ...digits, expiry_minutes: 10 }, {
      subject,
      text: `Your verification code is: ${otp}. It will expire in 5 minutes.`,
    });
  }

  // ── Welcome email (customer) ─────────────────────────────────────────────

  async sendWelcomeEmail(email: string, firstName: string): Promise<boolean> {
    return this.sendTemplate(email, 'welcome', { ...sharedVars(email, firstName) }, {
      subject: 'Welcome to SohCahToa',
      text: `Welcome to SohCahToa, ${firstName}! Your account has been successfully created and verified.`,
    });
  }

  // ── Agent welcome email ──────────────────────────────────────────────────

  async sendAgentWelcomeEmail(email: string, fullName: string, otp: string, setPasswordUrl: string): Promise<boolean> {
    const shared = sharedVars(email, fullName.split(' ')[0]);
    const result = await this.sendTemplate(email, 'agentWelcome', {
      ...shared,
      full_name:        fullName,
      otp,
      set_password_url: setPasswordUrl,
    }, {
      subject: 'Welcome to SohCahToa - Complete Your Agent Setup',
      text: `Welcome to SohCahToa, ${fullName}! Your agent account has been created. Your verification code to set your password is: ${otp}. Set your password here: ${setPasswordUrl}. This code expires in 24 hours.`,
    });
    if (!result) {
      console.error(`[EmailService] sendAgentWelcomeEmail failed for ${email} — template send returned false`);
    }
    return result;
  }

  // ── Admin welcome email ──────────────────────────────────────────────────

  async sendAdminWelcomeEmail(email: string, fullName: string, resetPasswordUrl: string): Promise<boolean> {
    const shared = sharedVars(email, fullName.split(' ')[0]);
    return this.sendTemplate(email, 'adminWelcome', {
      ...shared,
      full_name:          fullName,
      reset_password_url: resetPasswordUrl,
    }, {
      subject: 'Welcome to SohCahToa Admin Portal',
      text: `Welcome to SohCahToa, ${fullName}! Your admin account has been created. Set your password here: ${resetPasswordUrl}`,
    });
  }

  // ── Branch creation email ──────────────────────────────────────────────

  async sendBranchCreatedEmail(
    email: string,
    data: {
      branchName: string;
      branchCode: string;
      branchManager: string;
      state: string;
      city?: string | null;
      address: string;
      phoneNumber: string;
      branchEmail?: string | null;
    }
  ): Promise<boolean> {
    const shared = sharedVars(email, data.branchManager || 'Branch Manager');
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
        <h2 style="color: #0f172a; margin-top: 0;">New Branch Created</h2>
        <p>Hello ${data.branchManager},</p>
        <p>A new branch has been successfully created.</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 160px;">Branch Name:</td><td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${data.branchName}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b; font-weight: 600;">Branch Code:</td><td style="padding: 6px 0; color: #0f172a;">${data.branchCode}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b; font-weight: 600; vertical-align: top;">Branch Location:</td><td style="padding: 6px 0; color: #0f172a;">${data.address}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b; font-weight: 600;">Branch Manager:</td><td style="padding: 6px 0; color: #0f172a;">${data.branchManager}</td></tr>
          </table>
        </div>
        <p>You can now access the platform and begin managing activities assigned to your branch.</p>
        <p><a href="${shared.login_url}" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">Login here</a></p>
        <p style="margin-top: 24px; color: #64748b; font-size: 13px;">Regards,<br/><strong>SohCahToa Team</strong></p>
      </div>
    `;
    return this.sendTemplate(email, 'branchCreated', {
      ...shared,
      branch_name:    data.branchName,
      branch_code:    data.branchCode,
      branch_manager: data.branchManager,
      state:          data.state,
      city:           data.city || '',
      address:        data.address,
      phone_number:   data.phoneNumber,
      branch_email:   data.branchEmail || '',
    }, {
      subject: `New Branch Created – ${data.branchName}`,
      text: `Hello ${data.branchManager},\n\nA new branch has been successfully created.\nBranch Details:\n- Branch Name: ${data.branchName}\n- Branch Code: ${data.branchCode}\n- Branch Location: ${data.address}\n- Branch Manager: ${data.branchManager}\n\nYou can now access the platform and begin managing activities assigned to your branch.\nLogin here: ${shared.login_url}\n\nRegards.`,
      html,
    });
  }

  // ── Password reset confirmation ──────────────────────────────────────────

  async sendPasswordResetConfirmationEmail(email: string, firstName?: string): Promise<boolean> {
    const name = firstName || 'User';
    return this.sendTemplate(email, 'passwordResetConfirm', { ...sharedVars(email, name) }, {
      subject: 'Password Reset Successful - SohCahToa',
      text: `Hi ${name}, your password has been successfully reset. If you did not perform this action, please contact support immediately.`,
    });
  }

  // ── Password creation (temp password) ───────────────────────────────────

  async sendPasswordCreationEmail(email: string, firstName: string, temporaryPassword: string): Promise<boolean> {
    return this.sendTemplate(email, 'passwordCreation', {
      ...sharedVars(email, firstName),
      temporary_password: temporaryPassword,
    }, {
      subject: 'Complete Your Registration - Create Your Password',
      text: `Welcome ${firstName}! Your temporary password is: ${temporaryPassword}. Please login and change it immediately.`,
    });
  }

  // ── Transaction approved ─────────────────────────────────────────────────

  async sendTransactionApprovedEmail(email: string, firstName: string, transactionRef: string, amount: string, userId?: string): Promise<boolean> {
    const shared = sharedVars(email, firstName);
    const baseUrl = `${shared.app_url}/transactions/${transactionRef}`;
    const transaction_url = userId ? `${baseUrl}?userId=${userId}` : baseUrl;
    return this.sendTemplate(email, 'transactionApproved', {
      ...shared,
      transaction_ref: transactionRef,
      amount,
      transaction_url,
    }, {
      subject: `Transaction Approved - ${transactionRef}`,
      text: `Hi ${firstName}, your transaction ${transactionRef} for ${amount} has been approved and is being processed.`,
    });
  }

  // ── Transaction rejected ─────────────────────────────────────────────────

  async sendTransactionRejectedEmail(email: string, firstName: string, transactionRef: string, reason: string): Promise<boolean> {
    return this.sendTemplate(email, 'transactionRejected', {
      ...sharedVars(email, firstName),
      transaction_ref: transactionRef,
      reason,
    }, {
      subject: `Transaction Update - ${transactionRef}`,
      text: `Hi ${firstName}, your transaction ${transactionRef} could not be approved. Reason: ${reason}. Please contact support if you need assistance.`,
    });
  }

  // ── Deposit confirmed ─────────────────────────────────────────────────────

  async sendDepositConfirmedEmail(email: string, firstName: string, transactionRef: string, amount: string, userId?: string): Promise<boolean> {
    const shared = sharedVars(email, firstName);
    const baseUrl = `${shared.app_url}/transactions/${transactionRef}`;
    const transaction_url = userId ? `${baseUrl}?userId=${userId}` : baseUrl;
    return this.sendTemplate(email, 'depositConfirmed', {
      ...shared,
      transaction_ref: transactionRef,
      amount,
      transaction_url,
    }, {
      subject: `Deposit Confirmed - ${transactionRef}`,
      text: `Hi ${firstName}, we've confirmed your deposit of ${amount} for transaction ${transactionRef}. Your transaction is now being processed.`,
    });
  }

  // ── Settled transaction email (routes by type) ────────────────────────────
  //
  // Called when a transaction reaches COMPLETED status after disbursement.
  // The caller is responsible for populating the relevant fields for the type.

  async sendSettledTransactionEmail(
    type: string,
    email: string,
    firstName: string,
    data: {
      transactionId: string;
      amountDisplay: string;
      receiptUrl: string;
      // PTA / BTA
      bankName?: string;
      accountNumber?: string;
      branchName?: string;
      streetAddress?: string;
      cityState?: string;
      // School / Medical / Professional Body
      beneficiaryName?: string;
      beneficiaryAccount?: string;
      disbursementDate?: string;
      // Tourist
      pickupDate?: string;
    }
  ): Promise<boolean> {
    const shared = sharedVars(email, firstName);

    const remittanceTemplates: Record<string, keyof typeof TEMPLATES> = {
      PTA:               'ptaFundsRemitted',
      BTA:               'btaFundsRemitted',
      SCHOOL_FEES:       'schoolFeeDisbursed',
      MEDICAL:           'medicalFeeDisbursed',
      PROFESSIONAL_BODY: 'professionalBodyDisbursed',
      TOURIST_FX:        'touristCardPickup',
    };

    const templateKey = remittanceTemplates[type];
    if (!templateKey) {
      console.warn(`No settled email template for transaction type "${type}". Email not sent.`);
      return false;
    }

    const isPtaBta      = type === 'PTA' || type === 'BTA';
    const isBeneficiary = ['SCHOOL_FEES', 'MEDICAL', 'PROFESSIONAL_BODY'].includes(type);
    const isTourist     = type === 'TOURIST_FX';

    let vars: Record<string, string> = {
      ...shared,
      transaction_id: data.transactionId,
      amount_display: data.amountDisplay,
      receipt_url:    data.receiptUrl,
    };

    if (isPtaBta) {
      vars = {
        ...vars,
        bank_name:      data.bankName      || '',
        account_number: data.accountNumber || '',
        branch_name:    data.branchName    || '',
        street_address: data.streetAddress || '',
        city_state:     data.cityState     || '',
      };
    } else if (isBeneficiary) {
      vars = {
        ...vars,
        beneficiary_name:    data.beneficiaryName    || '',
        beneficiary_account: data.beneficiaryAccount || '',
        disbursement_date:   data.disbursementDate   || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' }),
      };
    } else if (isTourist) {
      vars = {
        ...vars,
        branch_name:    data.branchName    || '',
        street_address: data.streetAddress || '',
        city_state:     data.cityState     || '',
        pickup_date:    data.pickupDate    || 'Available Immediately',
      };
    }

    const subjectMap: Record<string, string> = {
      PTA:               `Your PTA funds have been remitted - ${data.transactionId}`,
      BTA:               `Your BTA funds have been remitted - ${data.transactionId}`,
      SCHOOL_FEES:       `Your school fee has been disbursed - ${data.transactionId}`,
      MEDICAL:           `Your medical fee payment has been disbursed - ${data.transactionId}`,
      PROFESSIONAL_BODY: `Your professional body fee has been disbursed - ${data.transactionId}`,
      TOURIST_FX:        `Your prepaid card is ready for pickup - ${data.transactionId}`,
    };

    return this.sendTemplate(email, templateKey, vars, {
      subject: subjectMap[type] || `Transaction Complete - ${data.transactionId}`,
      text: `Hi ${firstName}, your transaction ${data.transactionId} for ${data.amountDisplay} has been completed. Download your receipt here: ${data.receiptUrl}`,
    });
  }

  // ── Refund bank details request ───────────────────────────────────────────
  //
  // Sent when a transaction is marked AWAITING_REFUND_VERIFICATION, asking the
  // customer to submit bank details so the refund can be processed.

  async sendRefundBankDetailsEmail(
    email: string,
    firstName: string,
    data: {
      transactionId: string;
      transactionTypeLabel: string;
      refundAmountDisplay: string;
      provideBankDetailsUrl: string;
    }
  ): Promise<boolean> {
    return this.sendTemplate(email, 'refundBankDetailsRequest', {
      ...sharedVars(email, firstName),
      transaction_id:           data.transactionId,
      transaction_type_label:   data.transactionTypeLabel,
      refund_amount_display:    data.refundAmountDisplay,
      provide_bank_details_url: data.provideBankDetailsUrl,
    }, {
      subject: `Complete your refund request - ${data.transactionId}`,
      text: `Hi ${firstName}, a refund of ${data.refundAmountDisplay} has been initiated for your ${data.transactionTypeLabel} transaction (${data.transactionId}). Please provide your bank details here: ${data.provideBankDetailsUrl}`,
    });
  }

  // ── Flagged Transaction Escalation Email (Internal Control) ───────────────

  async sendFlaggedTransactionEscalationEmail(
    toEmail: string,
    data: {
      transactionRef: string;
      reason: string;
      severity?: string;
      amount?: string;
      customerName?: string;
      flaggedBy?: string;
      transactionType?: string;
      transactionDate?: Date | string | null;
    }
  ): Promise<boolean> {
    const dateTimeStr = data.transactionDate
      ? new Date(data.transactionDate).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' })
      : '';
    const internalControlEmail = toEmail || process.env.INTERNAL_CONTROL_EMAIL || 'internalcontrol@sohcahtoabdc.com';
    const shared = sharedVars(internalControlEmail, 'Internal Control Team');
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
        <h2 style="color: #dc2626; margin-top: 0;">Flagged Transaction – Action Required</h2>
        <p>Hello Admin,</p>
        <p>A transaction has been flagged for your review.</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 160px;">Transaction Reference:</td><td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${data.transactionRef}</td></tr>
            ${data.customerName ? `<tr><td style="padding: 6px 0; color: #64748b; font-weight: 600;">Customer Name:</td><td style="padding: 6px 0; color: #0f172a;">${data.customerName}</td></tr>` : ''}
            ${data.transactionType ? `<tr><td style="padding: 6px 0; color: #64748b; font-weight: 600;">Transaction Type:</td><td style="padding: 6px 0; color: #0f172a;">${data.transactionType}</td></tr>` : ''}
            ${data.amount ? `<tr><td style="padding: 6px 0; color: #64748b; font-weight: 600;">Amount:</td><td style="padding: 6px 0; color: #0f172a;">${data.amount}</td></tr>` : ''}
            ${dateTimeStr ? `<tr><td style="padding: 6px 0; color: #64748b; font-weight: 600;">Date &amp; Time:</td><td style="padding: 6px 0; color: #0f172a;">${dateTimeStr}</td></tr>` : ''}
            ${data.severity ? `<tr><td style="padding: 6px 0; color: #64748b; font-weight: 600;">Severity:</td><td style="padding: 6px 0; color: #dc2626; font-weight: 700;">${data.severity}</td></tr>` : ''}
            ${data.flaggedBy ? `<tr><td style="padding: 6px 0; color: #64748b; font-weight: 600;">Flagged By:</td><td style="padding: 6px 0; color: #0f172a;">${data.flaggedBy}</td></tr>` : ''}
          </table>
        </div>
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0; border-radius: 0 6px 6px 0;">
          <p style="margin: 0; font-size: 14px; color: #1e293b;"><strong>Reason for Flag:</strong> ${data.reason}</p>
        </div>
        <p>Please log in to the Admin Portal to review and take the appropriate action.</p>
        <p style="margin-top: 24px; color: #64748b; font-size: 13px;">Regards,<br/><strong>SohCahToa System Automated Alerts</strong></p>
      </div>
    `;

    return this.sendTemplate(internalControlEmail, 'flaggedTransactionEscalated', {
      ...shared,
      transaction_ref:  data.transactionRef,
      reason:           data.reason,
      severity:         data.severity || 'HIGH',
      amount:           data.amount || '',
      customer_name:    data.customerName || '',
      transaction_type: data.transactionType || '',
      date_time:        dateTimeStr,
      flagged_by:       data.flaggedBy || '',
    }, {
      subject: `Action Required: Flagged Transaction – ${data.transactionRef}`,
      text: `Hello Admin,\nA transaction has been flagged for your review.\n- Transaction Reference: ${data.transactionRef}\n${data.customerName ? `- Customer Name: ${data.customerName}\n` : ''}${data.transactionType ? `- Transaction Type: ${data.transactionType}\n` : ''}${data.amount ? `- Amount: ${data.amount}\n` : ''}${dateTimeStr ? `- Date & Time: ${dateTimeStr}\n` : ''}- Reason for Flag: ${data.reason}\n\nPlease log in to the Admin Portal to review and take the appropriate action.`,
      html,
    });
  }

  // ── Admin Transaction Activity Email ─────────────────────────────────────

  /**
   * Reusable admin-facing "Transaction Activity" notification —
   * covers Approved / Rejected / Cancelled / Updated / Flagged.
   */
  async sendAdminTransactionActivityEmail(
    adminEmail: string,
    adminName: string,
    data: {
      transactionRef: string;
      activityType: string;
      details?: string;
      amount?: string;
      customerName?: string;
      transactionType?: string;
      performedBy?: string;
      dateTime?: Date | string | null;
    }
  ): Promise<boolean> {
    const shared = sharedVars(adminEmail, adminName || 'Admin');
    const pastTense: Record<string, string> = {
      APPROVED: 'approved', REJECTED: 'rejected', CANCELLED: 'cancelled', UPDATED: 'updated', FLAGGED: 'flagged',
    };
    const activityStatement = pastTense[data.activityType.toUpperCase()]
      ? `Transaction has been ${pastTense[data.activityType.toUpperCase()]}.`
      : `Transaction activity: ${data.activityType}.`;
    const dateTimeStr = data.dateTime
      ? new Date(data.dateTime).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' })
      : '';
    const statusColors: Record<string, string> = {
      APPROVED: '#16a34a', REJECTED: '#dc2626', FLAGGED: '#dc2626', CANCELLED: '#64748b', UPDATED: '#2563eb',
    };
    const statusColor = statusColors[data.activityType.toUpperCase()] || '#2563eb';

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
        <h2 style="color: #0f172a; margin-top: 0;">Transaction Update: <span style="color: ${statusColor};">${data.activityType.replace(/_/g, ' ')}</span></h2>
        <p>Dear Admin,</p>
        <p>${activityStatement}</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 160px;">Transaction Reference:</td><td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${data.transactionRef}</td></tr>
            ${data.customerName ? `<tr><td style="padding: 6px 0; color: #64748b; font-weight: 600;">Customer Name:</td><td style="padding: 6px 0; color: #0f172a;">${data.customerName}</td></tr>` : ''}
            ${data.transactionType ? `<tr><td style="padding: 6px 0; color: #64748b; font-weight: 600;">Transaction Type:</td><td style="padding: 6px 0; color: #0f172a;">${data.transactionType}</td></tr>` : ''}
            ${data.amount ? `<tr><td style="padding: 6px 0; color: #64748b; font-weight: 600;">Amount:</td><td style="padding: 6px 0; color: #0f172a;">${data.amount}</td></tr>` : ''}
            ${data.performedBy ? `<tr><td style="padding: 6px 0; color: #64748b; font-weight: 600;">Performed By:</td><td style="padding: 6px 0; color: #0f172a;">${data.performedBy}</td></tr>` : ''}
            ${dateTimeStr ? `<tr><td style="padding: 6px 0; color: #64748b; font-weight: 600;">Date &amp; Time:</td><td style="padding: 6px 0; color: #0f172a;">${dateTimeStr}</td></tr>` : ''}
          </table>
        </div>
        ${data.details ? `<div style="background: #f8fafc; border-left: 4px solid ${statusColor}; padding: 16px; margin: 20px 0; border-radius: 0 6px 6px 0;"><p style="margin: 0; font-size: 14px; color: #334155;"><strong>Details:</strong> ${data.details}</p></div>` : ''}
        <p>Please log in to the Admin Portal for further details.</p>
        <p style="margin-top: 24px; color: #64748b; font-size: 13px;">Regards,<br/><strong>SohCahToa System Automated Alerts</strong></p>
      </div>
    `;

    return this.sendTemplate(adminEmail, 'transactionActivityAdmin', {
      ...shared,
      activity_type:      data.activityType,
      activity_statement: activityStatement,
      transaction_ref:    data.transactionRef,
      customer_name:      data.customerName || '',
      transaction_type:   data.transactionType || '',
      amount:             data.amount || '',
      performed_by:       data.performedBy || '',
      date_time:          dateTimeStr,
      details:            data.details || '',
    }, {
      subject: `Transaction Update – ${data.activityType}`,
      text: `Dear Admin,\n${activityStatement}\n- Activity Type: ${data.activityType}\n- Transaction Reference: ${data.transactionRef}\n${data.customerName ? `- Customer Name: ${data.customerName}\n` : ''}${data.transactionType ? `- Transaction Type: ${data.transactionType}\n` : ''}${data.amount ? `- Amount: ${data.amount}\n` : ''}${data.performedBy ? `- Performed By: ${data.performedBy}\n` : ''}${dateTimeStr ? `- Date & Time: ${dateTimeStr}\n` : ''}${data.details ? `- Details: ${data.details}\n` : ''}\nPlease log in to the Admin Portal for further details.`,
      html,
    });
  }

  // ── Admin notification: transaction initiated ────────────────────────────

  async sendTransactionInitiatedAdminEmail(
    adminEmail: string,
    data: {
      transactionRef: string;
      customerName?: string;
      transactionType?: string;
      amount?: string;
      dateTime?: Date | string | null;
    }
  ): Promise<boolean> {
    const shared = sharedVars(adminEmail, 'Admin');
    const dateTimeStr = data.dateTime
      ? new Date(data.dateTime).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' })
      : '';

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
        <h2 style="color: #0f172a; margin-top: 0;">New Transaction Initiated</h2>
        <p>Hello Admin,</p>
        <p>A new transaction has been initiated and is awaiting your review.</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 160px;">Transaction Reference:</td><td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${data.transactionRef}</td></tr>
            ${data.customerName ? `<tr><td style="padding: 6px 0; color: #64748b; font-weight: 600;">Customer Name:</td><td style="padding: 6px 0; color: #0f172a;">${data.customerName}</td></tr>` : ''}
            ${data.transactionType ? `<tr><td style="padding: 6px 0; color: #64748b; font-weight: 600;">Transaction Type:</td><td style="padding: 6px 0; color: #0f172a;">${data.transactionType}</td></tr>` : ''}
            ${data.amount ? `<tr><td style="padding: 6px 0; color: #64748b; font-weight: 600;">Amount:</td><td style="padding: 6px 0; color: #0f172a;">${data.amount}</td></tr>` : ''}
            ${dateTimeStr ? `<tr><td style="padding: 6px 0; color: #64748b; font-weight: 600;">Date &amp; Time:</td><td style="padding: 6px 0; color: #0f172a;">${dateTimeStr}</td></tr>` : ''}
          </table>
        </div>
        <p>Please log in to the Admin Portal to review the transaction.</p>
        <p><a href="${shared.login_url}" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">Login here</a></p>
        <p style="margin-top: 24px; color: #64748b; font-size: 13px;">Regards,<br/><strong>SohCahToa System Automated Alerts</strong></p>
      </div>
    `;

    return this.sendTemplate(adminEmail, 'transactionInitiatedAdmin', {
      ...shared,
      transaction_ref:  data.transactionRef,
      customer_name:    data.customerName || '',
      transaction_type: data.transactionType || '',
      amount:           data.amount || '',
      date_time:        dateTimeStr,
    }, {
      subject: `New Transaction Initiated – ${data.transactionRef}`,
      text: `Hello Admin,\nA new transaction has been initiated and awaiting your review.\nTransaction Details:\n- Transaction Reference: ${data.transactionRef}\n${data.customerName ? `- Customer Name: ${data.customerName}\n` : ''}${data.transactionType ? `- Transaction Type: ${data.transactionType}\n` : ''}${data.amount ? `- Amount: ${data.amount}\n` : ''}${dateTimeStr ? `- Date & Time: ${dateTimeStr}\n` : ''}\nPlease log in to the Admin Portal to review the transaction.\nLogin here: ${shared.login_url}\n\nRegards,`,
      html,
    });
  }

  // ── KYC approved ─────────────────────────────────────────────────────────

  async sendKycApprovedEmail(email: string, firstName: string): Promise<boolean> {
    return this.sendTemplate(email, 'kycApproved', { ...sharedVars(email, firstName) }, {
      subject: 'Identity Verified - SohCahToa',
      text: `Hi ${firstName}, congratulations! Your identity has been verified and your SohCahToa account is now fully active.`,
    });
  }

  // ── KYC rejected ─────────────────────────────────────────────────────────

  async sendKycRejectedEmail(email: string, firstName: string, reason: string): Promise<boolean> {
    return this.sendTemplate(email, 'kycRejected', {
      ...sharedVars(email, firstName),
      reason,
    }, {
      subject: 'Verification Unsuccessful - SohCahToa',
      text: `Hi ${firstName}, we were unable to verify your identity. Reason: ${reason}. Please resubmit your documents or contact support.`,
    });
  }

  // ── Account suspended ─────────────────────────────────────────────────────

  async sendAccountSuspendedEmail(email: string, firstName: string, reason: string): Promise<boolean> {
    return this.sendTemplate(email, 'accountSuspended', {
      ...sharedVars(email, firstName),
      reason,
    }, {
      subject: 'Account Suspended - SohCahToa',
      text: `Hi ${firstName}, your SohCahToa account has been temporarily suspended. Reason: ${reason}. Contact support if you believe this is an error.`,
    });
  }

  // ── Account activated ─────────────────────────────────────────────────────

  async sendAccountActivatedEmail(email: string, firstName: string): Promise<boolean> {
    return this.sendTemplate(email, 'accountActivated', { ...sharedVars(email, firstName) }, {
      subject: 'Account Reactivated - SohCahToa',
      text: `Hi ${firstName}, your SohCahToa account has been reactivated. You now have full access to all features.`,
    });
  }

  // ── Document approved ─────────────────────────────────────────────────────

  async sendDocumentApprovedEmail(email: string, firstName: string, transactionRef: string, documentType: string): Promise<boolean> {
    return this.sendTemplate(email, 'documentApproved', {
      ...sharedVars(email, firstName),
      transaction_ref: transactionRef,
      document_type:   documentType,
    }, {
      subject: `Document Approved - ${transactionRef}`,
      text: `Hi ${firstName}, your ${documentType} document for transaction ${transactionRef} has been approved. You will be notified once all documents are verified.`,
    });
  }

  // ── Document rejected ─────────────────────────────────────────────────────

  async sendDocumentRejectedEmail(email: string, firstName: string, transactionRef: string, documentType: string, reason: string): Promise<boolean> {
    return this.sendTemplate(email, 'documentRejected', {
      ...sharedVars(email, firstName),
      transaction_ref: transactionRef,
      document_type:   documentType,
      reason,
    }, {
      subject: `Document Rejected - ${transactionRef}`,
      text: `Hi ${firstName}, your ${documentType} document for transaction ${transactionRef} was rejected. Reason: ${reason}. Please resubmit a valid document.`,
    });
  }

  // ── Document resubmission requested ──────────────────────────────────────

  async sendDocumentResubmissionEmail(email: string, firstName: string, transactionRef: string, documentType: string, comment: string): Promise<boolean> {
    return this.sendTemplate(email, 'additionalInfoRequired', {
      ...sharedVars(email, firstName),
      transaction_ref: transactionRef,
      info:            comment,
    }, {
      subject: `Action Required: Document Resubmission - ${transactionRef}`,
      text: `Hi ${firstName}, additional information is required for your ${documentType} document on transaction ${transactionRef}: ${comment}. Please resubmit with corrections.`,
    });
  }

  // ── Payment details (virtual account) ────────────────────────────────────

  async sendPaymentDetailsEmail(
    email: string,
    firstName: string,
    transactionRef: string,
    amount: string,
    currency: string,
    virtualAccount: { accountNumber: string; accountName: string; bankName: string },
    userId?: string,
  ): Promise<boolean> {
    const shared = sharedVars(email, firstName);
    const baseUrl = `${shared.app_url}/transactions/${transactionRef}`;
    const transaction_url = userId ? `${baseUrl}?userId=${userId}` : baseUrl;
    return this.sendTemplate(email, 'transactionApproved', {
      ...shared,
      transaction_ref: transactionRef,
      amount:          `${currency} ${amount}`,
      transaction_url,
    }, {
      subject: `Payment Details - ${transactionRef}`,
      text: `Hi ${firstName}, your documents for transaction ${transactionRef} have been approved. Please make payment of ${currency} ${amount} to:\n\nBank: ${virtualAccount.bankName}\nAccount Name: ${virtualAccount.accountName}\nAccount Number: ${virtualAccount.accountNumber}\n\nThis virtual account is unique to your transaction. Payment is automatically confirmed when funds arrive.`,
    });
  }

  // ── Additional Information Required ───────────────────────────────────────

  async sendAdditionalInfoRequiredEmail(email: string, firstName: string, transactionRef: string, info: string): Promise<boolean> {
    return this.sendTemplate(email, 'additionalInfoRequired', {
      ...sharedVars(email, firstName),
      transaction_ref: transactionRef,
      info,
    }, {
      subject: `Additional Information Required - ${transactionRef}`,
      text: `Hi ${firstName}, your transaction ${transactionRef} requires additional information: ${info}. Please provide it to complete the transaction review.`,
    });
  }

  // ── Support Ticket / Transaction Dispute Notifications ────────────────────

  async sendSupportTicketCreatedEmail(
    email: string,
    firstName: string,
    ticket: {
      reference: string;
      caseType: string;
      priority?: string;
      description?: string;
    }
  ): Promise<boolean> {
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
        <h2 style="color: #0f172a; margin-top: 0;">Support Ticket Received</h2>
        <p>Dear ${firstName},</p>
        <p>Your support ticket has been received and logged in our system. Our support team is reviewing your inquiry.</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 140px;">Ticket Reference:</td><td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${ticket.reference}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b; font-weight: 600;">Category:</td><td style="padding: 6px 0; color: #0f172a;">${ticket.caseType}</td></tr>
            ${ticket.priority ? `<tr><td style="padding: 6px 0; color: #64748b; font-weight: 600;">Priority:</td><td style="padding: 6px 0; color: #0f172a;">${ticket.priority}</td></tr>` : ''}
            ${ticket.description ? `<tr><td style="padding: 6px 0; color: #64748b; font-weight: 600; vertical-align: top;">Description:</td><td style="padding: 6px 0; color: #0f172a;">${ticket.description}</td></tr>` : ''}
          </table>
        </div>
        <p>You can track the progress of this ticket anytime on your SohCahToa portal.</p>
        <p style="margin-top: 24px; color: #64748b; font-size: 13px;">Best regards,<br/><strong>SohCahToa Customer Support</strong></p>
      </div>
    `;

    const result = await this.sendEmail({
      to: email,
      subject: `Support Ticket Received - [${ticket.reference}] ${ticket.caseType}`,
      text: `Dear ${firstName},\n\nYour support ticket (${ticket.reference}) regarding "${ticket.caseType}" has been received. Our team is currently reviewing it and will respond shortly.\n\nDescription: ${ticket.description || 'N/A'}\n\nRegards,\nSohCahToa Support`,
      html,
    });
    return result.success;
  }

  async sendSupportTicketUpdatedEmail(
    email: string,
    firstName: string,
    ticket: {
      reference: string;
      caseType: string;
      changesSummary?: string;
    }
  ): Promise<boolean> {
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
        <h2 style="color: #0f172a; margin-top: 0;">Support Ticket Updated</h2>
        <p>Dear ${firstName},</p>
        <p>There has been an update on your support ticket <strong>${ticket.reference}</strong> (${ticket.caseType}).</p>
        ${ticket.changesSummary ? `<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;"><p style="margin: 0; font-size: 14px; color: #334155;"><strong>Update Details:</strong> ${ticket.changesSummary}</p></div>` : ''}
        <p>Log in to your account to view the complete history and details of your request.</p>
        <p style="margin-top: 24px; color: #64748b; font-size: 13px;">Best regards,<br/><strong>SohCahToa Customer Support</strong></p>
      </div>
    `;

    const result = await this.sendEmail({
      to: email,
      subject: `Update on Support Ticket - [${ticket.reference}] ${ticket.caseType}`,
      text: `Dear ${firstName},\n\nYour support ticket ${ticket.reference} (${ticket.caseType}) has been updated.\n\n${ticket.changesSummary || ''}\n\nPlease check your portal for full details.\n\nRegards,\nSohCahToa Support`,
      html,
    });
    return result.success;
  }

  async sendSupportTicketStatusUpdatedEmail(
    email: string,
    firstName: string,
    ticket: {
      reference: string;
      caseType: string;
      status: string;
      notes?: string;
    }
  ): Promise<boolean> {
    const isResolvedOrClosed = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
    const statusColor = isResolvedOrClosed ? '#16a34a' : '#2563eb';

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
        <h2 style="color: #0f172a; margin-top: 0;">Ticket Status: <span style="color: ${statusColor};">${ticket.status.replace(/_/g, ' ')}</span></h2>
        <p>Dear ${firstName},</p>
        <p>The status of your support ticket <strong>${ticket.reference}</strong> (${ticket.caseType}) has been updated to <strong style="color: ${statusColor};">${ticket.status.replace(/_/g, ' ')}</strong>.</p>
        ${ticket.notes ? `<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;"><p style="margin: 0; font-size: 14px; color: #334155;"><strong>Status Notes:</strong> ${ticket.notes}</p></div>` : ''}
        ${isResolvedOrClosed ? '<p>If you have any further questions or if the issue persists, please reply to this ticket or open a new inquiry.</p>' : '<p>Our team is actively working on resolving your request.</p>'}
        <p style="margin-top: 24px; color: #64748b; font-size: 13px;">Best regards,<br/><strong>SohCahToa Customer Support</strong></p>
      </div>
    `;

    const result = await this.sendEmail({
      to: email,
      subject: `Ticket Status Update: ${ticket.status.replace(/_/g, ' ')} - [${ticket.reference}]`,
      text: `Dear ${firstName},\n\nThe status of your support ticket ${ticket.reference} (${ticket.caseType}) has been updated to "${ticket.status}".\n\n${ticket.notes ? `Notes: ${ticket.notes}\n\n` : ''}Regards,\nSohCahToa Support`,
      html,
    });
    return result.success;
  }

  async sendSupportTicketCommentEmail(
    email: string,
    firstName: string,
    ticket: {
      reference: string;
      caseType: string;
      message: string;
      authorName?: string;
    }
  ): Promise<boolean> {
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
        <h2 style="color: #0f172a; margin-top: 0;">New Response on Support Ticket</h2>
        <p>Dear ${firstName},</p>
        <p>A new response has been posted on your support ticket <strong>${ticket.reference}</strong> (${ticket.caseType}):</p>
        <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0; border-radius: 0 6px 6px 0;">
          <p style="margin: 0; font-size: 14px; color: #1e293b; white-space: pre-wrap;">${ticket.message}</p>
          ${ticket.authorName ? `<p style="margin: 8px 0 0 0; font-size: 12px; color: #64748b;">— ${ticket.authorName}</p>` : ''}
        </div>
        <p>You can reply directly through your customer portal.</p>
        <p style="margin-top: 24px; color: #64748b; font-size: 13px;">Best regards,<br/><strong>SohCahToa Customer Support</strong></p>
      </div>
    `;

    const result = await this.sendEmail({
      to: email,
      subject: `New Message on Ticket - [${ticket.reference}] ${ticket.caseType}`,
      text: `Dear ${firstName},\n\nA new message has been added to your support ticket ${ticket.reference} (${ticket.caseType}):\n\n"${ticket.message}"\n\nRegards,\nSohCahToa Support`,
      html,
    });
    return result.success;
  }

  isReady(): boolean {
    return this.isConfigured || this.useTermii || Boolean(process.env.SMTP_HOST || process.env.SMS_API_KEY);
  }
}

export const emailService = new EmailService();
