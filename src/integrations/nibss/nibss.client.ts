import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('NIBSSClient');

/**
 * NIBSS API Client
 * Handles integration with Nigeria Inter-Bank Settlement System for:
 * - BVN verification
 * - Account verification
 * - Payment clearing and settlement
 */
export class NIBSSClient {
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.NIBSS_API_KEY || '';
    this.baseUrl = process.env.NIBSS_API_BASE_URL || 'https://api.nibss-plc.com.ng/v1';

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    // Request/Response interceptors
    this.client.interceptors.request.use(
      (config) => {
        logger.info('NIBSS API Request', { method: config.method, url: config.url });
        return config;
      },
      (error) => {
        logger.error('NIBSS API Request Error', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.info('NIBSS API Response', { status: response.status });
        return response;
      },
      (error) => {
        logger.error('NIBSS API Response Error', {
          status: error.response?.status,
          message: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Verify BVN and get customer details
   */
  async verifyBvn(bvn: string): Promise<{
    verified: boolean;
    data?: {
      bvn: string;
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      phoneNumber: string;
      watchListed: boolean;
    };
  }> {
    try {
      const response = await this.client.post('/bvn/verify', { bvn });
      return {
        verified: response.data.responseCode === '00',
        data: response.data.data,
      };
    } catch (error: any) {
      logger.error('BVN verification failed', { bvn, error: error.message });
      throw new Error(`BVN verification failed: ${error.message}`);
    }
  }

  /**
   * Verify bank account details
   */
  async verifyAccount(accountNumber: string, bankCode: string): Promise<{
    verified: boolean;
    accountName?: string;
    accountNumber?: string;
  }> {
    try {
      const response = await this.client.post('/account/verify', {
        accountNumber,
        bankCode,
      });
      return {
        verified: response.data.responseCode === '00',
        accountName: response.data.accountName,
        accountNumber: response.data.accountNumber,
      };
    } catch (error: any) {
      logger.error('Account verification failed', { accountNumber, error: error.message });
      throw new Error(`Account verification failed: ${error.message}`);
    }
  }

  /**
   * Initiate funds transfer
   */
  async initiateTransfer(data: {
    sourceAccountNumber: string;
    sourceBankCode: string;
    destinationAccountNumber: string;
    destinationBankCode: string;
    amount: number;
    narration: string;
    reference: string;
  }): Promise<{
    success: boolean;
    transactionReference: string;
    sessionId?: string;
  }> {
    try {
      const response = await this.client.post('/transfer/initiate', data);
      return {
        success: response.data.responseCode === '00',
        transactionReference: response.data.transactionReference,
        sessionId: response.data.sessionId,
      };
    } catch (error: any) {
      logger.error('Transfer initiation failed', { error: error.message });
      throw new Error(`Transfer initiation failed: ${error.message}`);
    }
  }

  /**
   * Check transaction status
   */
  async checkTransactionStatus(reference: string): Promise<{
    status: string;
    responseCode: string;
    responseMessage: string;
  }> {
    try {
      const response = await this.client.get(`/transaction/status/${reference}`);
      return {
        status: response.data.status,
        responseCode: response.data.responseCode,
        responseMessage: response.data.responseMessage,
      };
    } catch (error: any) {
      logger.error('Transaction status check failed', { reference, error: error.message });
      throw new Error(`Transaction status check failed: ${error.message}`);
    }
  }

  /**
   * Get list of banks
   */
  async getBankList(): Promise<Array<{
    bankCode: string;
    bankName: string;
  }>> {
    try {
      const response = await this.client.get('/banks');
      return response.data.banks || [];
    } catch (error: any) {
      logger.error('Failed to fetch bank list', { error: error.message });
      throw new Error(`Bank list fetch failed: ${error.message}`);
    }
  }
}

export const nibssClient = new NIBSSClient();
