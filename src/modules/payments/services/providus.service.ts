import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { createLogger } from '../../../shared/utils/logger';
import { AppError } from '../../../shared/utils/errors';
import { ErrorCode } from '../../../shared/types/common';

const logger = createLogger('ProvidusService');

interface ProvidusConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
}

interface CreateDynamicAccountRequest {
  account_name: string;
}

interface CreateDynamicAccountResponse {
  account_number: string;
  account_name: string;
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
  initiationTranRef: string;
}

interface CreateReservedAccountRequest {
  account_name: string;
  bvn?: string;
}

interface CreateReservedAccountResponse {
  account_number: string;
  account_name: string;
  bvn?: string;
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
}

interface UpdateAccountNameRequest {
  account_number: string;
  account_name: string;
}

interface UpdateAccountNameResponse {
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
}

interface VerifyTransactionResponse {
  sessionId: string;
  initiationTranRef: string;
  accountNumber: string;
  tranRemarks: string;
  transactionAmount: number;
  settledAmount: number;
  feeAmount: number;
  vatAmount: number;
  currency: string;
  settlementId: string;
  sourceAccountNumber: string;
  sourceAccountName: string;
  sourceBankName: string;
  channelId: string;
  tranDateTime: string;
}

interface BlacklistAccountRequest {
  account_number: string;
  blacklist_flg: number; // 1 to blacklist, 0 to unblacklist
}

interface BlacklistAccountResponse {
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
}

export class ProvidusService {
  private client: AxiosInstance;
  private config: ProvidusConfig;

  constructor() {
    this.config = {
      baseUrl: process.env.PROVIDUS_BASE_URL || '',
      clientId: process.env.PROVIDUS_CLIENT_ID || '',
      clientSecret: process.env.PROVIDUS_CLIENT_SECRET || '',
    };

    if (!this.config.baseUrl || !this.config.clientId || !this.config.clientSecret) {
      logger.warn('Providus configuration incomplete - some features may not work');
    }

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth headers
    this.client.interceptors.request.use((config) => {
      const authSignature = this.generateAuthSignature();
      config.headers['X-Auth-Signature'] = authSignature;
      config.headers['Client-Id'] = this.config.clientId;
      return config;
    });

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.info('Providus API Response', {
          url: response.config.url,
          status: response.status,
          data: response.data,
        });
        return response;
      },
      (error) => {
        logger.error('Providus API Error', {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        throw error;
      }
    );
  }

  /**
   * Generate authentication signature for Providus API
   * Format: clientId:clientSecret
   */
  private generateAuthSignature(): string {
    return `${this.config.clientId}:${this.config.clientSecret}`;
  }

  /**
   * Create a dynamic virtual account number
   * Used for one-time transactions
   */
  async createDynamicAccount(accountName: string): Promise<CreateDynamicAccountResponse> {
    try {
      logger.info('Creating dynamic account', { accountName });

      const response = await this.client.post<CreateDynamicAccountResponse>(
        '/api/PiPCreateDynamicAccountNumber',
        { account_name: accountName }
      );

      if (!response.data.requestSuccessful) {
        throw new AppError(
          ErrorCode.EXTERNAL_SERVICE_ERROR,
          `Failed to create dynamic account: ${response.data.responseMessage}`,
          400
        );
      }

      logger.info('Dynamic account created successfully', {
        accountNumber: response.data.account_number,
        accountName: response.data.account_name,
      });

      return response.data;
    } catch (error) {
      logger.error('Error creating dynamic account', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        'Failed to create virtual account',
        500
      );
    }
  }

  /**
   * Create a reserved/static virtual account number
   * Used for permanent customer accounts
   */
  async createReservedAccount(
    accountName: string,
    bvn?: string
  ): Promise<CreateReservedAccountResponse> {
    try {
      logger.info('Creating reserved account', { accountName, bvn });

      const response = await this.client.post<CreateReservedAccountResponse>(
        '/api/PiPCreateReservedAccountNumber',
        {
          account_name: accountName,
          bvn: bvn || '',
        }
      );

      if (!response.data.requestSuccessful) {
        throw new AppError(
          ErrorCode.EXTERNAL_SERVICE_ERROR,
          `Failed to create reserved account: ${response.data.responseMessage}`,
          400
        );
      }

      logger.info('Reserved account created successfully', {
        accountNumber: response.data.account_number,
        accountName: response.data.account_name,
      });

      return response.data;
    } catch (error) {
      logger.error('Error creating reserved account', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        'Failed to create reserved account',
        500
      );
    }
  }

  /**
   * Update account name for existing virtual account
   */
  async updateAccountName(
    accountNumber: string,
    accountName: string
  ): Promise<UpdateAccountNameResponse> {
    try {
      logger.info('Updating account name', { accountNumber, accountName });

      const response = await this.client.post<UpdateAccountNameResponse>(
        '/api/PiPUpdateAccountName',
        {
          account_number: accountNumber,
          account_name: accountName,
        }
      );

      if (!response.data.requestSuccessful) {
        throw new AppError(
          ErrorCode.EXTERNAL_SERVICE_ERROR,
          `Failed to update account name: ${response.data.responseMessage}`,
          400
        );
      }

      logger.info('Account name updated successfully', { accountNumber });

      return response.data;
    } catch (error) {
      logger.error('Error updating account name', error);
      if (error instanceof AppError) throw error;
      throw new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, 'Failed to update account name', 500);
    }
  }

  /**
   * Verify transaction by session ID
   */
  async verifyTransactionBySessionId(sessionId: string): Promise<VerifyTransactionResponse> {
    try {
      logger.info('Verifying transaction by session ID', { sessionId });

      const response = await this.client.get<VerifyTransactionResponse>(
        '/api/PiPverifyTransaction',
        {
          params: { session_id: sessionId },
        }
      );

      // Check if transaction was found
      if (response.data.tranRemarks === 'Transaction not found!!!') {
        throw new AppError(ErrorCode.NOT_FOUND, 'Transaction not found', 404);
      }

      logger.info('Transaction verified successfully', {
        sessionId: response.data.sessionId,
        amount: response.data.transactionAmount,
        settled: response.data.settledAmount,
      });

      return response.data;
    } catch (error) {
      logger.error('Error verifying transaction by session ID', error);
      if (error instanceof AppError) throw error;
      throw new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, 'Failed to verify transaction', 500);
    }
  }

  /**
   * Verify transaction by settlement ID
   */
  async verifyTransactionBySettlementId(settlementId: string): Promise<VerifyTransactionResponse> {
    try {
      logger.info('Verifying transaction by settlement ID', { settlementId });

      const response = await this.client.get<VerifyTransactionResponse>(
        '/api/PiPverifyTransaction_settlementid',
        {
          params: { settlement_id: settlementId },
        }
      );

      // Check if transaction was found
      if (response.data.tranRemarks === 'Transaction not found!!!') {
        throw new AppError(ErrorCode.NOT_FOUND, 'Transaction not found', 404);
      }

      logger.info('Transaction verified successfully', {
        settlementId: response.data.settlementId,
        amount: response.data.transactionAmount,
        settled: response.data.settledAmount,
      });

      return response.data;
    } catch (error) {
      logger.error('Error verifying transaction by settlement ID', error);
      if (error instanceof AppError) throw error;
      throw new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, 'Failed to verify transaction', 500);
    }
  }

  /**
   * Blacklist or unblacklist an account
   */
  async blacklistAccount(
    accountNumber: string,
    blacklist: boolean = true
  ): Promise<BlacklistAccountResponse> {
    try {
      logger.info('Updating account blacklist status', { accountNumber, blacklist });

      const response = await this.client.post<BlacklistAccountResponse>(
        '/api/PiPBlacklistAccount',
        {
          account_number: accountNumber,
          blacklist_flg: blacklist ? 1 : 0,
        }
      );

      if (!response.data.requestSuccessful) {
        // Don't throw error if account is already blacklisted/unblacklisted
        if (response.data.responseMessage.includes('already')) {
          logger.warn('Account blacklist status unchanged', {
            accountNumber,
            message: response.data.responseMessage,
          });
          return response.data;
        }

        throw new AppError(
          ErrorCode.EXTERNAL_SERVICE_ERROR,
          `Failed to update blacklist: ${response.data.responseMessage}`,
          400
        );
      }

      logger.info('Account blacklist status updated successfully', { accountNumber, blacklist });

      return response.data;
    } catch (error) {
      logger.error('Error updating account blacklist status', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        'Failed to update account blacklist status',
        500
      );
    }
  }

  /**
   * Verify webhook signature from Providus
   * This should be used to validate incoming webhook requests
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', this.config.clientSecret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }
}

export default new ProvidusService();
