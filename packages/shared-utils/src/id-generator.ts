import { v4 as uuidv4 } from 'uuid';

export const generateId = (): string => {
  return uuidv4();
};

export const generateTransactionReference = (prefix: string = 'TXN'): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

export const generateOtp = (length: number = 6): string => {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
};

export const generateReceiptNumber = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `RCP-${year}${month}${day}-${random}`;
};

export const generatePickupCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};
