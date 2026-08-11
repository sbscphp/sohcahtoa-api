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
      if (!templateId) {
        console.warn(`Termii template ID not configured for "${templateKey}". Email not sent.`);
        return false;
      }
      try {
        const result = await emailClient.sendTemplateEmail(to, templateId, data, fallback.subject);
        if (!result.success) {
          console.error(`Termii template email returned non-success (${templateKey}) for ${to}`);
        }
        return result.success;
      } catch (error: any) {
        console.error(`Termii template email failed (${templateKey}) for ${to}:`, error?.response?.data || error?.message || error);
        return false;
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

  isReady(): boolean {
    return this.isConfigured || this.useTermii;
  }
}

export const emailService = new EmailService();
