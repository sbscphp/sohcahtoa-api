import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('EmailClient');

/**
 * Termii Email Client
 * Handles transactional email via Termii's Email Product Notification API.
 *
 * Relevant Termii endpoints:
 *   POST /templates/send-email  — send a template-based email
 *   POST /email/otp/send        — send a one-time code via Termii's built-in OTP email
 */
export class EmailClient {
  private client: AxiosInstance;
  private apiKey: string;
  private emailConfigId: string;

  constructor() {
    this.apiKey = process.env.SMS_API_KEY || '';
    this.emailConfigId = process.env.TERMII_EMAIL_CONFIG_ID || '';

    this.client = axios.create({
      baseURL: 'https://v3.api.termii.com/api',
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Send a template-based email.
   * POST /templates/send-email
   *
   * @param to          Recipient email address
   * @param templateId  Template ID from Termii dashboard
   * @param variables   Key-value map matching the {{placeholder}} names in the template
   * @param subject     Email subject line shown in the recipient's inbox
   */
  async sendTemplateEmail(
    to: string,
    templateId: string,
    variables: Record<string, string | number>,
    subject: string,
  ): Promise<{ success: boolean; messageId?: string }> {
    try {
      logger.info('Sending template email via Termii', { to, templateId });

      const response = await this.client.post('/templates/send-email', {
        api_key: this.apiKey,
        email: to,
        subject,
        email_configuration_id: this.emailConfigId,
        template_id: templateId,
        variables,
      });

      const success = response.data?.code === 'ok' || response.data?.message_id !== undefined || response.status === 200;

      logger.info('Termii template email sent', { to, templateId, success });

      return {
        success,
        messageId: response.data?.message_id,
      };
    } catch (error: any) {
      logger.error('Termii template email failed', { to, templateId, error: error.message });
      throw error;
    }
  }

  /**
   * Send a one-time passcode via Termii's dedicated OTP email endpoint.
   * POST /email/otp/send
   * Used as fallback when no custom template is configured for OTPs.
   */
  async sendOtpEmail(to: string, code: string): Promise<{ success: boolean; messageId?: string }> {
    try {
      logger.info('Sending OTP email via Termii', { to });

      const response = await this.client.post('/email/otp/send', {
        api_key: this.apiKey,
        email_address: to,
        code,
        email_configuration_id: this.emailConfigId,
      });

      const success = response.status === 200 || response.data?.message_id !== undefined;

      logger.info('Termii OTP email sent', { to, success });

      return {
        success,
        messageId: response.data?.message_id,
      };
    } catch (error: any) {
      logger.error('Termii OTP email failed', { to, error: error.message });
      throw error;
    }
  }
}

export const emailClient = new EmailClient();
