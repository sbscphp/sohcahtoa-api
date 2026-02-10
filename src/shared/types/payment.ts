export enum PaymentStatus {
  PENDING = 'PENDING',
  AWAITING_CONFIRMATION = 'AWAITING_CONFIRMATION',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  BANK_TRANSFER = 'BANK_TRANSFER',
  CARD = 'CARD',
  MOBILE_MONEY = 'MOBILE_MONEY',
  CASH_DEPOSIT = 'CASH_DEPOSIT',
}

export interface ExchangeRateRequest {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
}

export interface ExchangeRateResponse {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  amount: number;
  convertedAmount: number;
  rateValidUntil: string;
}

export interface DepositRequest {
  transactionId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  bankDetails?: BankTransferDetails;
}

export interface BankTransferDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
  reference: string;
}

export interface DepositConfirmationRequest {
  transactionId: string;
  paymentReference: string;
  proofOfPayment?: string;
}

export interface Settlement {
  id: string;
  transactionId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  depositedAt?: string;
  confirmedAt?: string;
}

export interface PayoutInstruction {
  transactionId: string;
  amount: number;
  currency: string;
  method: string;
  recipientDetails: RecipientDetails;
}

export interface RecipientDetails {
  name: string;
  bankName?: string;
  accountNumber?: string;
  swiftCode?: string;
  iban?: string;
  phoneNumber?: string;
  address?: string;
}

export interface ImtoPayoutRequest {
  transactionId: string;
  provider: string;
  amount: number;
  currency: string;
  recipientDetails: RecipientDetails;
}

export interface PaymentReceipt {
  id: string;
  transactionId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  receiptNumber: string;
  generatedAt: string;
}

export interface CreateExchangeRateRequest {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  validUntil: string;
  source?: string;
}
