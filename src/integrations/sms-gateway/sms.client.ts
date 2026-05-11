import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('SMSClient');

export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  balance?: number;
}

/**
 * SMS Client — Termii Messaging API
 * Docs: POST https://v3.api.termii.com/api/sms/send
 *       POST https://v3.api.termii.com/api/sms/send/bulk
 *
 * Channels:
 *   dnd      — transactional/OTP, bypasses DND restrictions (use for all critical messages)
 *   generic  — promotional only, will not reach DND numbers, MTN restricted 8PM–8AM WAT
 *   whatsapp — sends via WhatsApp channel
 *   voice    — converts text to speech, delivered as a voice call
 */
export class SMSClient {
  private client: AxiosInstance;
  private provider: string;
  private apiKey: string;
  private senderId: string;

  constructor() {
    this.provider = process.env.SMS_PROVIDER || 'termii';
    this.apiKey = process.env.SMS_API_KEY || '';
    this.senderId = process.env.SMS_SENDER_ID || 'Sochatoa';

    const baseUrls: Record<string, string> = {
      termii: 'https://v3.api.termii.com/api',
      infobip: 'https://api.infobip.com',
    };

    this.client = axios.create({
      baseURL: baseUrls[this.provider] || baseUrls.termii,
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Send a promotional SMS.
   * Uses the generic route — will NOT reach numbers on DND.
   * Do NOT use for OTPs or transactional messages.
   */
  async sendSms(to: string, message: string): Promise<SmsSendResult> {
    if (this.provider === 'termii') {
      return this.termiiSend({ to, message, channel: 'generic', type: 'plain' });
    }
    if (this.provider === 'infobip') {
      return this.infobipSend(to, message);
    }
    throw new Error(`Unsupported SMS provider: ${this.provider}`);
  }

  /**
   * Send an OTP / transactional SMS.
   * Uses the DND route — delivers to ALL numbers including DND-registered ones.
   * Required for verification codes, alerts, and all critical messages.
   */
  async sendOtp(to: string, otp: string, _purpose: string): Promise<SmsSendResult> {
    const message = `Your Sochatoa verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`;
    if (this.provider === 'termii') {
      return this.termiiSend({ to, message, channel: 'dnd', type: 'plain' });
    }
    return this.sendSms(to, message);
  }

  /**
   * Send a WhatsApp message.
   * channel must be 'whatsapp', from must be a registered WhatsApp device name.
   */
  async sendWhatsApp(to: string, message: string): Promise<SmsSendResult> {
    return this.termiiSend({ to, message, channel: 'whatsapp', type: 'plain' });
  }

  /**
   * Send a voice message (text-to-speech call).
   * Tip: add spaces between digits in OTPs for clearer speech (e.g. "1 2 3 4 5 6").
   */
  async sendVoice(to: string, message: string): Promise<SmsSendResult> {
    return this.termiiSend({ to, message, channel: 'voice', type: 'voice' });
  }

  /**
   * Send the same message to up to 100 numbers at once.
   * POST /sms/send/bulk
   */
  async sendBulkSms(
    recipients: string[],
    message: string,
    channel: 'dnd' | 'generic' = 'generic',
  ): Promise<SmsSendResult> {
    return this.termiiSendBulk({ to: recipients, message, channel, type: 'plain' });
  }

  // ── Termii implementation ──────────────────────────────────────────────────

  /**
   * POST /sms/send
   * Single recipient. Response: { code, balance, message_id, message_id_str, message, user }
   */
  private async termiiSend(params: {
    to: string;
    message: string;
    channel: 'dnd' | 'generic' | 'whatsapp' | 'voice';
    type: 'plain' | 'unicode' | 'encrypted' | 'voice';
  }): Promise<SmsSendResult> {
    try {
      logger.info('Sending SMS via Termii', { to: params.to, channel: params.channel });

      const response = await this.client.post('/sms/send', {
        api_key: this.apiKey,
        to: params.to,
        from: this.senderId,
        sms: params.message,
        type: params.type,
        channel: params.channel,
      });

      const data = response.data;
      const success = data?.code === 'ok';

      if (success) {
        logger.info('Termii SMS sent', { to: params.to, messageId: data.message_id, balance: data.balance });
      } else {
        logger.warn('Termii SMS unexpected response', { to: params.to, data });
      }

      return {
        success,
        messageId: data?.message_id_str || data?.message_id,
        balance: data?.balance,
      };
    } catch (error: any) {
      logger.error('Termii SMS failed', { to: params.to, error: error.message });
      throw error;
    }
  }

  /**
   * POST /sms/send/bulk
   * Up to 100 recipients. Same response shape as single send.
   */
  private async termiiSendBulk(params: {
    to: string[];
    message: string;
    channel: 'dnd' | 'generic';
    type: 'plain' | 'unicode' | 'encrypted';
  }): Promise<SmsSendResult> {
    try {
      logger.info('Sending bulk SMS via Termii', { recipients: params.to.length, channel: params.channel });

      const response = await this.client.post('/sms/send/bulk', {
        api_key: this.apiKey,
        to: params.to,
        from: this.senderId,
        sms: params.message,
        type: params.type,
        channel: params.channel,
      });

      const data = response.data;
      const success = data?.code === 'ok';

      logger.info('Termii bulk SMS sent', { recipients: params.to.length, success, balance: data?.balance });

      return {
        success,
        messageId: data?.message_id_str || data?.message_id,
        balance: data?.balance,
      };
    } catch (error: any) {
      logger.error('Termii bulk SMS failed', { error: error.message });
      throw error;
    }
  }

  // ── Infobip fallback ───────────────────────────────────────────────────────

  private async infobipSend(to: string, message: string): Promise<SmsSendResult> {
    try {
      const response = await this.client.post(
        '/sms/2/text/advanced',
        {
          messages: [
            {
              from: this.senderId,
              destinations: [{ to }],
              text: message,
            },
          ],
        },
        { headers: { Authorization: `App ${this.apiKey}` } },
      );

      const msg = response.data.messages?.[0];
      return {
        success: msg?.status?.groupId === 1,
        messageId: msg?.messageId,
      };
    } catch (error: any) {
      logger.error('Infobip SMS failed', { to, error: error.message });
      throw error;
    }
  }
}

export const smsClient = new SMSClient();
