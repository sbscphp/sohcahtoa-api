# NIBSS Integration Documentation

## Overview

This module provides integration with **NIBSS (Nigeria Inter-Bank Settlement System)** for various financial verification and compliance services.

## Available Services

### 1. BIVS (BVN & Identity Verification Service)
- **Client ID**: `5680171a-b9f9-4786-ae00-75bb5e9caad2`
- **App Name**: BIVS (SOHCAHTOA_FINANCE)
- **Base URL**: `https://apitest.nibss-plc.com.ng:1443`
- **Environment**: CERTIFICATION

**Features**:
- BVN (Bank Verification Number) verification
- TIN (Tax Identification Number) verification
- Bank account verification
- Identity validation

### 2. ConsentMgmt (Consent Management)
- **Client ID**: `57b06b79-2825-4aa6-ae08-bd098ba8bfa7`
- **App Name**: ConsentMgmt (SOHCAHTOA_FINANCE)
- **Base URL**: `https://apitest.nibss-plc.com.ng:1443`
- **Environment**: CERTIFICATION

**Features**:
- Customer consent management
- Consent tracking and expiry
- Compliance with data protection regulations

## Environment Configuration

Add the following to your `.env` file:

```bash
# NIBSS BIVS Configuration
NIBSS_BIVS_CLIENT_ID=5680171a-b9f9-4786-ae00-75bb5e9caad2
NIBSS_BIVS_CLIENT_SECRET=YOUR_NIBSS_BIVS_CLIENT_SECRET
NIBSS_BIVS_BASE_URL=https://apitest.nibss-plc.com.ng:1443
NIBSS_BIVS_RESET_URL=https://apitest.nibss-plc.com.ng:1443/reset

# NIBSS ConsentMgmt Configuration
NIBSS_CONSENT_CLIENT_ID=57b06b79-2825-4aa6-ae08-bd098ba8bfa7
NIBSS_CONSENT_CLIENT_SECRET=YOUR_NIBSS_CONSENT_CLIENT_SECRET
NIBSS_CONSENT_BASE_URL=https://apitest.nibss-plc.com.ng:1443
NIBSS_CONSENT_RESET_URL=https://apitest.nibss-plc.com.ng:1443/reset

# Environment
NIBSS_ENVIRONMENT=CERTIFICATION
```

## Usage Examples

### BVN Verification

```typescript
import { nibssClient } from '@/integrations/nibss/nibss.client';

// Basic BVN verification
const result = await nibssClient.verifyBvn({
  BVN: '12345678901',
  PhoneNumber: '+2348012345678', // Optional
  DoB: '1990-01-15', // Optional, format: YYYY-MM-DD
  FirstName: 'John', // Optional
  LastName: 'Doe', // Optional
});

if (result.verified) {
  console.log('BVN verified:', result.data);
  console.log('First Name:', result.data.firstName);
  console.log('Last Name:', result.data.lastName);
  console.log('Watch Listed:', result.data.watchListed);
} else {
  console.error('Verification failed:', result.message);
}
```

### TIN Verification

```typescript
import { nibssClient } from '@/integrations/nibss/nibss.client';

// Verify Tax Identification Number
const result = await nibssClient.verifyTin({
  TIN: '12345678',
  FullName: 'Acme Corporation Ltd', // Optional
});

if (result.verified) {
  console.log('TIN verified:', result.data);
  console.log('Tax Payer Name:', result.data.taxPayerName);
  console.log('Tax Office:', result.data.taxOffice);
  console.log('Status:', result.data.status);
}
```

### Account Verification

```typescript
import { nibssClient } from '@/integrations/nibss/nibss.client';

// Verify bank account
const result = await nibssClient.verifyAccount(
  '0123456789', // Account number
  '058' // Bank code
);

if (result.verified) {
  console.log('Account verified');
  console.log('Account Name:', result.accountName);
}
```

### Consent Management

```typescript
import { nibssClient } from '@/integrations/nibss/nibss.client';

// Request customer consent
const result = await nibssClient.requestConsent({
  customerId: 'user-123',
  serviceType: 'BVN_VERIFICATION',
  duration: 30, // days
  purpose: 'KYC verification for account opening',
});

if (result.success) {
  console.log('Consent obtained');
  console.log('Consent ID:', result.consentId);
  console.log('Expires on:', result.expiryDate);
}
```

### Using Service Wrappers

The application provides convenient service wrappers:

#### BVN Service

```typescript
import bvnService from '@/modules/auth/services/bvn.service';

// Simple BVN verification
const result = await bvnService.verifyBvn('12345678901');

// With additional parameters
const result2 = await bvnService.verifyBvn(
  '12345678901',
  '+2348012345678', // phone
  '1990-01-15', // DOB
  'John', // firstName
  'Doe' // lastName
);

// With consent management
const result3 = await bvnService.verifyBvnWithConsent(
  '12345678901',
  'user-123', // userId
  'KYC Verification' // purpose
);
```

#### TIN Service

```typescript
import tinService from '@/modules/auth/services/tin.service';

// Simple TIN verification
const result = await tinService.verifyTin('12345678');

// With full name
const result2 = await tinService.verifyTin(
  '12345678',
  'Acme Corporation Ltd'
);

// With consent management
const result3 = await tinService.verifyTinWithConsent(
  '12345678',
  'user-123', // userId
  'Tax Compliance Check', // purpose
  'Acme Corporation Ltd' // fullName
);
```

## Authentication

The NIBSS client automatically handles OAuth2 authentication using the client credentials flow:

1. Tokens are requested automatically on first API call
2. Tokens are cached and reused until expiry
3. Tokens are refreshed automatically 5 minutes before expiration
4. Separate tokens are managed for BIVS and ConsentMgmt services

To manually reset tokens (e.g., for testing):

```typescript
import { nibssClient } from '@/integrations/nibss/nibss.client';

nibssClient.resetTokens();
```

## Response Codes

NIBSS uses standard response codes:

| Code | Meaning |
|------|---------|
| `00` | Success |
| `01` | Invalid request |
| `02` | Record not found |
| `03` | Unauthorized |
| `99` | System error |

## Error Handling

All methods return structured responses with success indicators:

```typescript
interface NIBSSResponse {
  verified: boolean; // or success: boolean
  data?: any;
  message: string;
}
```

Always check the `verified` or `success` field before accessing data:

```typescript
const result = await nibssClient.verifyBvn({ BVN: '12345678901' });

if (result.verified) {
  // Safe to access result.data
  console.log(result.data.firstName);
} else {
  // Handle error
  console.error(result.message);
}
```

## Fallback Behavior

For development and testing, the service automatically falls back to mock data when:

1. NIBSS credentials are not configured in environment variables
2. NIBSS API is unavailable (in development/test environments only)

Mock data generates consistent, realistic test data based on input values.

## Logging

All NIBSS operations are logged with sensitive data redacted:

- BVN/TIN numbers are masked (e.g., `***8901`)
- Tokens and secrets are never logged
- All API requests and responses are logged at INFO level
- Errors are logged at ERROR level with full stack traces

## Security Considerations

1. **Never commit credentials**: Keep `.env` file out of version control
2. **Use HTTPS only**: All NIBSS endpoints must use HTTPS
3. **Rotate secrets regularly**: Update client secrets periodically
4. **Monitor API usage**: Track API calls for anomalies
5. **Implement rate limiting**: Prevent abuse of verification endpoints
6. **Validate inputs**: Always validate BVN/TIN formats before API calls
7. **Obtain consent**: Use ConsentMgmt for compliance with data protection laws

## Testing

### Unit Tests

```bash
npm test src/integrations/nibss
```

### Integration Tests

Set test credentials in `.env.test`:

```bash
NIBSS_BIVS_CLIENT_ID=test-client-id
NIBSS_BIVS_CLIENT_SECRET=test-client-secret
```

## Migration from Old to New API

If migrating from a previous NIBSS integration:

### Old Code
```typescript
// Old implementation
const response = await oldNibssApi.verifyBVN(bvn);
```

### New Code
```typescript
// New implementation
import { nibssClient } from '@/integrations/nibss/nibss.client';

const result = await nibssClient.verifyBvn({ BVN: bvn });
if (result.verified) {
  // Handle success
}
```

## Support & Troubleshooting

### Common Issues

**1. Authentication Failed**
- Verify client ID and secret in `.env`
- Check if credentials are for correct environment (CERTIFICATION vs PRODUCTION)
- Ensure base URL includes port `:1443`

**2. Request Timeout**
- Check network connectivity
- Verify NIBSS services are operational
- Increase timeout in client configuration if needed

**3. Invalid Response Format**
- Check NIBSS API version compatibility
- Review request payload format
- Verify all required fields are provided

### Debug Mode

Enable detailed logging:

```typescript
// Set log level to debug in your logger configuration
process.env.LOG_LEVEL = 'debug';
```

## Production Deployment

When moving to production:

1. Update environment variables with production credentials
2. Change `NIBSS_ENVIRONMENT` to `PRODUCTION`
3. Update base URLs to production endpoints
4. Enable rate limiting on verification endpoints
5. Set up monitoring and alerting for API failures
6. Implement audit logging for all verifications

## API Rate Limits

Contact NIBSS for specific rate limits. Recommended approach:

- Implement exponential backoff for retries
- Cache verification results when appropriate
- Batch requests where possible
- Monitor API usage and set internal limits

## Compliance

This integration helps meet Nigerian regulatory requirements:

- **CBN KYC Requirements**: BVN verification for customer onboarding
- **FIRS Tax Compliance**: TIN verification for tax reporting
- **Data Protection**: Consent management for NDPR compliance
- **AML/CFT**: Identity verification and watch list checking

## Additional Resources

- [NIBSS Official Documentation](https://nibss-plc.com.ng)
- [CBN Guidelines on KYC](https://www.cbn.gov.ng)
- [FIRS Tax Identification](https://www.firs.gov.ng)

## License

This integration is part of the SOHCAHTOA Finance platform.

## Changelog

### v1.0.0 (Current)
- Initial NIBSS integration with BIVS and ConsentMgmt
- BVN verification with OAuth2 authentication
- TIN verification support
- Account verification
- Consent management
- Automatic token refresh
- Mock data fallback for development
- Comprehensive logging and error handling
