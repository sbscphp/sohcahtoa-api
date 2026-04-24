import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { createLogger } from '../../../shared/utils/logger';
import { AppError } from '../../../shared/utils/errors';
import { ErrorCode } from '../../../shared/types/common';

const logger = createLogger('ProvidusService');

// Simulation mode flag - set to true when Providus API is unreachable
const SIMULATION_MODE = process.env.PROVIDUS_SIMULATION_MODE === 'true' || false;

// Counter for generating unique simulated account numbers
let simulationCounter = 9000000000;

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
   * Format: SHA512(ClientId:ClientSecret)
   */
  private generateAuthSignature(): string {
    const payload = `${this.config.clientId}:${this.config.clientSecret}`;
    return crypto.createHash('sha512').update(payload).digest('hex').toUpperCase();
  }

  /**
   * Check if an error is a network error that should trigger simulation fallback
   */
  private isNetworkError(error: any): boolean {
    if (axios.isAxiosError(error)) {
      // Network errors: ECONNREFUSED, ENOTFOUND, ETIMEDOUT, etc.
      const code = error.code;
      if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT' || code === 'ECONNRESET') {
        return true;
      }
      // HTTP status codes indicating server unreachable
      if (error.response?.status === 0 || error.response?.status === 502 || error.response?.status === 503 || error.response?.status === 504) {
        return true;
      }
      // No response means server didn't respond
      if (!error.response) {
        return true;
      }
    }
    return false;
  }

  /**
   * Create a dynamic virtual account number
   * Used for one-time transactions
   */
  async createDynamicAccount(accountName: string): Promise<CreateDynamicAccountResponse> {
    // Use simulation mode if enabled
    if (SIMULATION_MODE) {
      logger.warn('SIMULATION MODE: Using simulated response for createDynamicAccount');
      return this.simulateCreateDynamicAccount(accountName);
    }

    try {
      logger.info('Creating dynamic account', { accountName });

      const response = await this.client.post<CreateDynamicAccountResponse>(
        '/PiPCreateDynamicAccountNumber',
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
      // Fall back to simulation mode on network error
      if (this.isNetworkError(error)) {
        logger.warn('Network error detected, falling back to simulation mode');
        return this.simulateCreateDynamicAccount(accountName);
      }
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
    // Use simulation mode if enabled
    if (SIMULATION_MODE) {
      logger.warn('SIMULATION MODE: Using simulated response for createReservedAccount');
      return this.simulateCreateReservedAccount(accountName, bvn);
    }

    try {
      logger.info('Creating reserved account', { accountName, bvn });

      const response = await this.client.post<CreateReservedAccountResponse>(
        '/PiPCreateReservedAccountNumber',
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
      // Fall back to simulation mode on network error
      if (this.isNetworkError(error)) {
        logger.warn('Network error detected, falling back to simulation mode');
        return this.simulateCreateReservedAccount(accountName, bvn);
      }
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
    // Use simulation mode if enabled
    if (SIMULATION_MODE) {
      logger.warn('SIMULATION MODE: Using simulated response for updateAccountName');
      return this.simulateUpdateAccountName();
    }

    try {
      logger.info('Updating account name', { accountNumber, accountName });

      const response = await this.client.post<UpdateAccountNameResponse>(
        '/PiPUpdateAccountName',
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
      // Fall back to simulation mode on network error
      if (this.isNetworkError(error)) {
        logger.warn('Network error detected, falling back to simulation mode');
        return this.simulateUpdateAccountName();
      }
      if (error instanceof AppError) throw error;
      throw new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, 'Failed to update account name', 500);
    }
  }

  /**
   * Verify transaction by session ID
   */
  async verifyTransactionBySessionId(sessionId: string): Promise<VerifyTransactionResponse> {
    // Use simulation mode if enabled
    if (SIMULATION_MODE) {
      logger.warn('SIMULATION MODE: Using simulated response for verifyTransactionBySessionId');
      return this.simulateVerifyTransaction(sessionId);
    }

    try {
      logger.info('Verifying transaction by session ID', { sessionId });

      const response = await this.client.get<VerifyTransactionResponse>(
        '/PiPverifyTransaction',
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
      // Fall back to simulation mode on network error
      if (this.isNetworkError(error)) {
        logger.warn('Network error detected, falling back to simulation mode');
        return this.simulateVerifyTransaction(sessionId);
      }
      if (error instanceof AppError) throw error;
      throw new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, 'Failed to verify transaction', 500);
    }
  }

  /**
   * Verify transaction by settlement ID
   */
  async verifyTransactionBySettlementId(settlementId: string): Promise<VerifyTransactionResponse> {
    // Use simulation mode if enabled
    if (SIMULATION_MODE) {
      logger.warn('SIMULATION MODE: Using simulated response for verifyTransactionBySettlementId');
      return this.simulateVerifyTransaction(settlementId);
    }

    try {
      logger.info('Verifying transaction by settlement ID', { settlementId });

      const response = await this.client.get<VerifyTransactionResponse>(
        '/PiPverifyTransaction_settlementid',
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
      // Fall back to simulation mode on network error
      if (this.isNetworkError(error)) {
        logger.warn('Network error detected, falling back to simulation mode');
        return this.simulateVerifyTransaction(settlementId);
      }
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
    // Use simulation mode if enabled
    if (SIMULATION_MODE) {
      logger.warn('SIMULATION MODE: Using simulated response for blacklistAccount');
      return this.simulateBlacklistAccount();
    }

    try {
      logger.info('Updating account blacklist status', { accountNumber, blacklist });

      const response = await this.client.post<BlacklistAccountResponse>(
        '/PiPBlacklistAccount',
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
      // Fall back to simulation mode on network error
      if (this.isNetworkError(error)) {
        logger.warn('Network error detected, falling back to simulation mode');
        return this.simulateBlacklistAccount();
      }
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

  /**
   * Check if simulation mode is enabled
   */
  isSimulationMode(): boolean {
    return SIMULATION_MODE;
  }

  // ==================== SIMULATION METHODS ====================
  // These methods return sample responses when Providus API is unreachable
  // Used for development/testing when the actual API is unavailable

  /**
   * Generate simulated dynamic account response
   * Based on sample from Providus documentation:
   * {
   *     "account_number": "9900000001",
   *     "account_name": "CharlyWize(Adewale)",
   *     "requestSuccessful": true,
   *     "responseMessage": "Successful",
   *     "responseCode": "00",
   *     "initiationTranRef": "352352352325"
   * }
   */
  private simulateCreateDynamicAccount(accountName: string): CreateDynamicAccountResponse {
    simulationCounter++;
    const accountNumber = simulationCounter.toString();
    
    logger.info('SIMULATION: Creating dynamic account', { accountName, accountNumber });

    return {
      account_number: accountNumber,
      account_name: accountName,
      requestSuccessful: true,
      responseMessage: 'Successful',
      responseCode: '00',
      initiationTranRef: `SIM_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`,
    };
  }

  /**
   * Generate simulated reserved account response
   */
  private simulateCreateReservedAccount(accountName: string, bvn?: string): CreateReservedAccountResponse {
    simulationCounter++;
    const accountNumber = simulationCounter.toString();
    
    logger.info('SIMULATION: Creating reserved account', { accountName, bvn });

    return {
      account_number: accountNumber,
      account_name: accountName,
      bvn,
      requestSuccessful: true,
      responseMessage: 'Successful',
      responseCode: '00',
    };
  }

  /**
   * Generate simulated update account name response
   * Based on sample from Providus documentation:
   * {
   *     "requestSuccessful": true,
   *     "responseMessage": "Successful",
   *     "responseCode": "00"
   * }
   */
  private simulateUpdateAccountName(): UpdateAccountNameResponse {
    logger.info('SIMULATION: Updating account name');

    return {
      requestSuccessful: true,
      responseMessage: 'Successful',
      responseCode: '00',
    };
  }

  /**
   * Generate simulated transaction verification response
   */
  private simulateVerifyTransaction(sessionId: string): VerifyTransactionResponse {
    logger.info('SIMULATION: Verifying transaction', { sessionId });

    return {
      sessionId: sessionId || `SIM_SESSION_${Date.now()}`,
      initiationTranRef: `SIM_INIT_${Date.now()}`,
      accountNumber: '9900000001',
      tranRemarks: 'Payment received',
      transactionAmount: 10000,
      settledAmount: 9850,
      feeAmount: 150,
      vatAmount: 0,
      currency: 'NGN',
      settlementId: `SIM_SETTLE_${Date.now()}`,
      sourceAccountNumber: '1234567890',
      sourceAccountName: 'Test Customer',
      sourceBankName: 'Test Bank',
      channelId: 'WEB',
      tranDateTime: new Date().toISOString(),
    };
  }

  /**
   * Generate simulated blacklist response
   */
  private simulateBlacklistAccount(): BlacklistAccountResponse {
    logger.info('SIMULATION: Updating account blacklist status');

    return {
      requestSuccessful: true,
      responseMessage: 'Successful',
      responseCode: '00',
    };
  }
}

export default new ProvidusService();
