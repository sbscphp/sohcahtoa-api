import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('CardClient');

/**
 * Card Issuance API Client
 * Handles prepaid/debit card issuance via processors like Interswitch, Unified Payments
 */
export class CardClient {
  private client: AxiosInstance;
  private provider: string;
  private apiKey: string;

  constructor() {
    this.provider = process.env.CARD_PROVIDER || 'interswitch';
    this.apiKey = process.env.CARD_API_KEY || '';

    const baseUrls: Record<string, string> = {
      interswitch: 'https://sandbox.interswitchng.com/api/v1',
      unified: 'https://api.unifiedpayments.com/v1',
    };

    this.client = axios.create({
      baseURL: baseUrls[this.provider],
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });
  }

  /**
   * Issue virtual prepaid card
   */
  async issueVirtualCard(data: {
    customerId: string;
    customerName: string;
    amount: number;
    currency: string;
    expiryMonths?: number;
  }): Promise<{
    success: boolean;
    cardNumber: string;
    expiryDate: string;
    cvv: string;
    cardId: string;
  }> {
    try {
      const response = await this.client.post('/cards/virtual/issue', {
        ...data,
        expiryMonths: data.expiryMonths || 12,
      });

      return {
        success: true,
        cardNumber: response.data.cardNumber,
        expiryDate: response.data.expiryDate,
        cvv: response.data.cvv,
        cardId: response.data.cardId,
      };
    } catch (error: any) {
      logger.error('Virtual card issuance failed', { error: error.message });
      throw new Error(`Card issuance failed: ${error.message}`);
    }
  }

  /**
   * Issue physical prepaid card
   */
  async issuePhysicalCard(data: {
    customerId: string;
    customerName: string;
    amount: number;
    currency: string;
    deliveryAddress: {
      street: string;
      city: string;
      state: string;
      country: string;
      postalCode: string;
    };
  }): Promise<{
    success: boolean;
    cardId: string;
    orderReference: string;
    estimatedDelivery: string;
  }> {
    try {
      const response = await this.client.post('/cards/physical/issue', data);

      return {
        success: true,
        cardId: response.data.cardId,
        orderReference: response.data.orderReference,
        estimatedDelivery: response.data.estimatedDelivery,
      };
    } catch (error: any) {
      logger.error('Physical card issuance failed', { error: error.message });
      throw new Error(`Physical card issuance failed: ${error.message}`);
    }
  }

  /**
   * Fund card (load value)
   */
  async fundCard(cardId: string, amount: number): Promise<{
    success: boolean;
    newBalance: number;
    transactionReference: string;
  }> {
    try {
      const response = await this.client.post(`/cards/${cardId}/fund`, { amount });

      return {
        success: true,
        newBalance: response.data.newBalance,
        transactionReference: response.data.transactionReference,
      };
    } catch (error: any) {
      logger.error('Card funding failed', { cardId, error: error.message });
      throw new Error(`Card funding failed: ${error.message}`);
    }
  }

  /**
   * Get card details
   */
  async getCardDetails(cardId: string): Promise<{
    cardId: string;
    cardNumber: string;
    balance: number;
    status: string;
    expiryDate: string;
  }> {
    try {
      const response = await this.client.get(`/cards/${cardId}`);

      return {
        cardId: response.data.cardId,
        cardNumber: response.data.cardNumber,
        balance: response.data.balance,
        status: response.data.status,
        expiryDate: response.data.expiryDate,
      };
    } catch (error: any) {
      logger.error('Failed to fetch card details', { cardId, error: error.message });
      throw new Error(`Card details fetch failed: ${error.message}`);
    }
  }

  /**
   * Freeze/Unfreeze card
   */
  async updateCardStatus(cardId: string, action: 'FREEZE' | 'UNFREEZE'): Promise<{
    success: boolean;
    status: string;
  }> {
    try {
      const response = await this.client.post(`/cards/${cardId}/status`, { action });

      return {
        success: true,
        status: response.data.status,
      };
    } catch (error: any) {
      logger.error('Card status update failed', { cardId, action, error: error.message });
      throw new Error(`Card status update failed: ${error.message}`);
    }
  }
}

export const cardClient = new CardClient();
