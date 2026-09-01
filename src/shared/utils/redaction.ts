/**
 * Redaction utilities for sensitive data
 * Used to ensure sensitive information is not exposed to frontend
 */

export interface RedactionOptions {
  preserveNames?: boolean; // If true, firstName and lastName are not redacted
}

/**
 * Redact sensitive user data while preserving non-sensitive fields
 * Typically used in verification flows where only names should be visible
 * 
 * @param data - The data object to redact
 * @param options - Redaction options
 * @returns Object with sensitive fields redacted
 */
export function redactSensitiveData<T extends Record<string, any>>(
  data: T,
  options: RedactionOptions = {}
): Partial<T> {
  const { preserveNames = true } = options;

  const redacted: Partial<T> = {};

  // List of fields that are always sensitive and should be redacted
  const sensitiveFields = [
    'email',
    'phoneNumber',
    'phone',
    'address',
    'bvn',
    'passportNumber',
    'passport',
    'ssn',
    'nin',
    'nationalId',
    'accountNumber',
    'bankCode',
    'creditCard',
    'cvv',
    'pin',
  ];

  // List of fields that are safe and should always be included
  const safeFields = ['firstName', 'lastName', 'dateOfBirth', 'gender', 'nationality', 'country'];

  for (const [key, value] of Object.entries(data)) {
    // Always include safe fields
    if (safeFields.includes(key)) {
      redacted[key as keyof T] = value;
      continue;
    }

    // Optionally preserve names
    if (preserveNames && (key === 'firstName' || key === 'lastName')) {
      redacted[key as keyof T] = value;
      continue;
    }

    // Redact sensitive fields
    if (sensitiveFields.includes(key)) {
      continue;
    }

    // Include other non-sensitive fields
    redacted[key as keyof T] = value;
  }

  return redacted;
}

/**
 * Redact a single sensitive field by replacing with asterisks
 * Used for displaying partially redacted information (e.g., "john.****@example.com")
 * 
 * @param value - The value to redact
 * @param type - The type of field (email, phone, bvn, etc.)
 * @returns Partially redacted value
 */
export function partiallyRedactField(value: string, type: 'email' | 'phone' | 'bvn' | 'nin' | 'tin' | 'passport'): string {
  if (!value) return '';

  switch (type) {
    case 'email': {
      const [localPart, domain] = value.split('@');
      if (!domain) return '***';
      const visibleLocal = localPart.substring(0, 2);
      return `${visibleLocal}${'*'.repeat(Math.max(1, localPart.length - 2))}@${domain}`;
    }
    case 'phone': {
      const visibleEnd = value.slice(-4);
      return `${'*'.repeat(Math.max(1, value.length - 4))}${visibleEnd}`;
    }
    case 'bvn':
    case 'nin':
    case 'tin': {
      const visibleEnd = value.slice(-4);
      return `${'*'.repeat(Math.max(1, value.length - 4))}${visibleEnd}`;
    }
    case 'passport': {
      const visibleEnd = value.slice(-3);
      return `${'*'.repeat(Math.max(1, value.length - 3))}${visibleEnd}`;
    }
    default:
      return '***';
  }
}
