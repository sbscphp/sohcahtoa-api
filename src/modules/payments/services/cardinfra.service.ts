import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { createLogger } from '../../../shared/utils/logger';
import { AppError } from '../../../shared/utils/errors';
import { ErrorCode } from '../../../shared/types/common';

const logger = createLogger('CardInfraService');

export interface OnboardCustomerInput {
  firstName: string;
  middleName?: string;
  lastName: string;
  email?: string | null;
  phone: string;
  nationality: string;
  countryCode: string;
  address?: string | null;
  residentCountry?: string | null;
}

export interface TxnQuery {
  cardId?: string;
  fromDate?: string;
  toDate?: string;
  page: number;
  pageSize: number;
}

/**
 * Client for the CardInfra FIP Prepaid API (Providus Bank).
 * Auth: POST /api/v1/account/login with clientId + SHA-512(clientSecret) -> Bearer token.
 */
class CardInfraService {
  private client: AxiosInstance;
  private token: string | null = null;
  private tokenExpiresAt = 0;
  private loginInFlight: Promise<string> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.CARDINFRA_BASE_URL || 'https://ttp-api.payinfra.io',
      timeout: Number(process.env.CARDINFRA_TIMEOUT_MS) || 30000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async login(): Promise<string> {
    const clientId = process.env.CARDINFRA_CLIENT_ID;
    const secret = process.env.CARDINFRA_CLIENT_SECRET;
    if (!clientId || !secret) {
      throw new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, 'CardInfra credentials are not configured', 503);
    }
    const clientSecret = crypto.createHash('sha512').update(secret).digest('hex');
    const { data } = await this.client.post('/api/v1/account/login', { clientId, clientSecret });
    if (!data?.successful || !data?.token) {
      throw new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, 'CardInfra login failed', 502);
    }
    this.token = data.token;
    const exp = data.expiration ? Date.parse(data.expiration) : NaN;
    // refresh 60s early; fall back to 10 minutes if expiry is missing
    this.tokenExpiresAt = (Number.isNaN(exp) ? Date.now() + 10 * 60_000 : exp) - 60_000;
    return this.token as string;
  }

  private async getToken(force = false): Promise<string> {
    if (!force && this.token && Date.now() < this.tokenExpiresAt) return this.token;
    if (!this.loginInFlight) {
      this.loginInFlight = this.login().finally(() => {
        this.loginInFlight = null;
      });
    }
    return this.loginInFlight;
  }

  private async request<T>(
    method: 'get' | 'post',
    path: string,
    opts: { body?: unknown; params?: Record<string, unknown> } = {}
  ): Promise<T> {
    const send = async (token: string) =>
      this.client.request<T>({
        method,
        url: path,
        data: opts.body,
        params: opts.params,
        headers: { Authorization: `Bearer ${token}` },
      });
    try {
      let res;
      try {
        res = await send(await this.getToken());
      } catch (e: any) {
        if (e?.response?.status !== 401) throw e;
        res = await send(await this.getToken(true));
      }
      return res.data;
    } catch (error: any) {
      const status = error?.response?.status;
      const data = error?.response?.data;
      logger.error('CardInfra API error', {
        path,
        method,
        status,
        code: error?.code,
        // never log request bodies here: set-pin carries a PIN
        response: data,
      });
      if (status === 400) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, data?.detail || 'Card provider rejected the request', 400, data?.errors);
      }
      if (status === 404) {
        throw new AppError(ErrorCode.NOT_FOUND, 'Card resource not found', 404);
      }
      throw new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, 'Card provider request failed', 502);
    }
  }

  onboardCustomer(input: OnboardCustomerInput) {
    return this.request<{ customerId: string; existingCustomer: boolean }>('post', '/api/v1/onboard', { body: input });
  }

  getProfiles() {
    return this.request<Array<{ id: string; name: string }>>('get', '/api/v1/opt/profiles');
  }

  getCardProfiles() {
    return this.request<Array<{ id: string; name: string }>>('get', '/api/v1/opt/card-profiles');
  }

  requestCard(input: { profileId: string; cardProfileId: string; nameOnCards?: string[]; instantQty?: number }) {
    return this.request<{ successful: boolean; requestNo: string; requestId: string }>('post', '/api/v1/card-request', { body: input });
  }

  associateCard(customerId: string, cardId: string) {
    return this.request<{ successful: boolean }>('post', '/api/v1/card/add', { body: { customerId, cardId } });
  }

  async listCards(filters: { customerId?: string; maskedPan?: string; nameOnCard?: string }) {
    const res = await this.request<{ total: number; data: any[] }>('get', '/api/v1/cards', {
      params: { CustomerId: filters.customerId, MaskedPan: filters.maskedPan, NameOnCard: filters.nameOnCard },
    });
    return res;
  }

  loadCard(cardId: string, amount: number) {
    return this.request<any>('post', '/api/v1/card/fund/load', { body: { amount, cardId } });
  }

  unloadCard(cardId: string, amount: number) {
    return this.request<any>('post', '/api/v1/card/fund/unload', { body: { amount, cardId } });
  }

  blockCard(cardId: string) {
    return this.request<any>('post', '/api/v1/card/block', { body: { cardId } });
  }

  unblockCard(cardId: string) {
    return this.request<any>('post', '/api/v1/card/unblock', { body: { cardId } });
  }

  setPin(cardId: string, pin: string) {
    return this.request<any>('post', '/api/v1/card/set-pin', { body: { cardId, pin } });
  }

  getCardTransactions(q: TxnQuery) {
    return this.request<{ total: number; data: any[] }>('get', '/api/v1/card-transactions', {
      params: { CardId: q.cardId, FromDate: q.fromDate, ToDate: q.toDate, Page: q.page, PageSize: q.pageSize },
    });
  }

  getFundingTransactions(q: TxnQuery) {
    return this.request<{ total: number; data: any[] }>('get', '/api/v1/fund-transactions', {
      params: { CardId: q.cardId, FromDate: q.fromDate, ToDate: q.toDate, Page: q.page, PageSize: q.pageSize },
    });
  }
}

export default new CardInfraService();
