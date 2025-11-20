export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhoneNumber = (phone: string): boolean => {
  // Nigerian phone number format: +234XXXXXXXXXX or 0XXXXXXXXXX
  const phoneRegex = /^(\+234|0)[789][01]\d{8}$/;
  return phoneRegex.test(phone);
};

export const validateBvn = (bvn: string): boolean => {
  // BVN is 11 digits
  return /^\d{11}$/.test(bvn);
};

export const validateTin = (tin: string): boolean => {
  // TIN format varies, but typically 10-14 digits
  return /^\d{10,14}$/.test(tin);
};

export const validatePassportNumber = (passport: string): boolean => {
  // Nigerian passport: A followed by 8 digits
  return /^A\d{8}$/.test(passport);
};

export const validateAmount = (amount: number): boolean => {
  return amount > 0 && Number.isFinite(amount);
};

export const sanitizeString = (str: string): string => {
  return str.trim().replace(/[<>]/g, '');
};

export const validateRequiredFields = (obj: any, fields: string[]): { valid: boolean; missing: string[] } => {
  const missing = fields.filter((field) => !obj[field]);
  return {
    valid: missing.length === 0,
    missing,
  };
};
