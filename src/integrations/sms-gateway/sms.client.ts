import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('SMSClient');

/**
 * SMS Gateway Client
 * Supports multiple providers: Termii, Infobip
 */
export class SMSClient {
  private client: AxiosInstance;
  private provider: string;
  private apiKey: string;

  constructor() {
    this.provider = process.env.SMS_PROVIDER || 'termii';
    this.apiKey = process.env.SMS_API_KEY || '';

    const baseUrls: Record<string, string> = {
      termii: 'https://v3.api.termii.com/api',
      infobip: 'https://api.infobip.com',
    };

    this.client = axios.create({
      baseURL: baseUrls[this.provider],
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Send SMS message
   */
  async sendSms(to: string, message: string): Promise<{
    success: boolean;
    messageId?: string;
  }> {
    try {
      if (this.provider === 'termii') {
        return await this.sendTermiiSms(to, message);
      } else if (this.provider === 'infobip') {
        return await this.sendInfobipSms(to, message);
      }
      throw new Error(`Unsupported SMS provider: ${this.provider}`);
    } catch (error: any) {
      logger.error('SMS sending failed', { to, error: error.message });
      throw error;
    }
  }

  /**
   * Send OTP via SMS
   */
  async sendOtp(to: string, otp: string, purpose: string): Promise<{
    success: boolean;
    messageId?: string;
  }> {
    const message = `Your SOHCAHTOA verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`;
    return this.sendSms(to, message);
  }

  /**
   * Termii implementation
   */
  private async sendTermiiSms(to: string, message: string): Promise<{
    success: boolean;
    messageId?: string;
  }> {
    const response = await this.client.post('/sms/send', {
      to,
      from: process.env.SMS_SENDER_ID || 'SOHCAHTOA',
      sms: message,
      type: 'plain',
      channel: 'generic',
      api_key: this.apiKey,
    });

    return {
      success: response.data.message_id !== undefined,
      messageId: response.data.message_id,
    };
  }

  /**
   * Infobip implementation
   */
  private async sendInfobipSms(to: string, message: string): Promise<{
    success: boolean;
    messageId?: string;
  }> {
    const response = await this.client.post(
      '/sms/2/text/advanced',
      {
        messages: [
          {
            from: process.env.SMS_SENDER_ID || 'SOHCAHTOA',
            destinations: [{ to }],
            text: message,
          },
        ],
      },
      {
        headers: {
          Authorization: `App ${this.apiKey}`,
        },
      }
    );

    return {
      success: response.data.messages?.[0]?.status?.groupId === 1,
      messageId: response.data.messages?.[0]?.messageId,
    };
  }
}

export const smsClient = new SMSClient();
