# NIBSS API Integration Support Checklist

## Issue Summary
We are experiencing **401 Unauthorized** errors when attempting to authenticate with the NIBSS BIVS API in the CERTIFICATION environment.

**Date**: April 7, 2026
**Environment**: CERTIFICATION (apitest.nibss-plc.com.ng)
**Error**: `Request failed with status code 401`

---

## Current Configuration

### BIVS (BVN Verification Service)
- **Client ID**: `5680171a-b9f9-4786-ae00-75bb5e9caad2`
- **Base URL**: `https://apitest.nibss-plc.com.ng:1443`
- **Reset URL**: `https://apitest.nibss-plc.com.ng:1443/reset`

### ConsentMgmt (Consent Management)
- **Client ID**: `57b06b79-2825-4aa6-ae08-bd098ba8bfa7`
- **Base URL**: `https://apitest.nibss-plc.com.ng:1443`
- **Reset URL**: `https://apitest.nibss-plc.com.ng:1443/reset`

---

## Authentication Methods Attempted

### Method 1: OAuth2 Client Credentials Flow
```http
POST https://apitest.nibss-plc.com.ng:1443/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id=5680171a-b9f9-4786-ae00-75bb5e9caad2
&client_secret=YOUR_NIBSS_BIVS_CLIENT_SECRET
```

**Result**: 401 Unauthorized

### Method 2: Basic Authentication
```http
POST https://apitest.nibss-plc.com.ng:1443/token
Authorization: Basic <base64(client_id:client_secret)>
Content-Type: application/json

{
  "grant_type": "client_credentials"
}
```

**Result**: 401 Unauthorized

### Method 3: Alternative OAuth2 Endpoint
```http
POST https://apitest.nibss-plc.com.ng:1443/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id=5680171a-b9f9-4786-ae00-75bb5e9caad2
&client_secret=YOUR_NIBSS_BIVS_CLIENT_SECRET
```

**Result**: 401 Unauthorized

---

## Questions for NIBSS Support

### 1. Credential Activation
- [ ] Are the provided credentials activated for the CERTIFICATION environment?
- [ ] Is there a separate activation or onboarding process required?
- [ ] Do we need to whitelist our IP address or domain?
- [ ] Are there any account activation steps we may have missed?

### 2. Authentication Method
- [ ] What is the correct authentication method for BIVS API?
  - OAuth2 Client Credentials?
  - Basic Authentication?
  - API Key in header?
  - Other method?
- [ ] What is the exact token endpoint URL we should use?
- [ ] Are there any additional headers required (e.g., `X-API-Key`, `Ocp-Apim-Subscription-Key`)?
- [ ] Is there a specific scope or resource parameter needed for BIVS?

### 3. API Endpoints
- [ ] What is the correct token endpoint URL for BIVS?
  - `/oauth/token`
  - `/token`
  - `/api/oauth/token`
  - Other?
- [ ] What is the correct BVN verification endpoint?
  - `/api/bivs/verify`
  - `/bivs/verify-bvn`
  - Other?
- [ ] What is the correct TIN verification endpoint?

### 4. Request Format
- [ ] What is the exact format for the token request?
- [ ] Should we use `application/x-www-form-urlencoded` or `application/json`?
- [ ] Are there any required fields beyond `grant_type`, `client_id`, and `client_secret`?
- [ ] Do we need to include a `scope` parameter?

### 5. Response Format
- [ ] What should a successful token response look like?
- [ ] What is the token type (Bearer, etc.)?
- [ ] What is the typical token expiration time?
- [ ] How should we handle token refresh?

### 6. Environment Configuration
- [ ] Is the base URL `https://apitest.nibss-plc.com.ng:1443` correct for CERTIFICATION?
- [ ] Should we use port 1443 or a different port?
- [ ] Are there separate endpoints for BIVS and ConsentMgmt?

### 7. Documentation
- [ ] Can you provide the official API documentation for BIVS?
- [ ] Can you provide the official API documentation for ConsentMgmt?
- [ ] Are there any Postman collections or example code available?
- [ ] Is there a developer portal or sandbox we should be using?

### 8. Error Details
- [ ] Can you provide more details about what causes a 401 error?
- [ ] Are there any logs on your end showing our authentication attempts?
- [ ] Is there a way to get more detailed error messages beyond the 401 status code?

---

## Sample Code Used

### Token Acquisition (TypeScript)
```typescript
// OAuth2 Method
const params = new URLSearchParams();
params.append('grant_type', 'client_credentials');
params.append('client_id', process.env.NIBSS_BIVS_CLIENT_ID);
params.append('client_secret', process.env.NIBSS_BIVS_CLIENT_SECRET);

const response = await axios.post(
  'https://apitest.nibss-plc.com.ng:1443/oauth/token',
  params,
  {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 10000,
  }
);
```

### BVN Verification Attempt
```typescript
// After obtaining token (if successful)
const response = await axios.post(
  'https://apitest.nibss-plc.com.ng:1443/api/bivs/verify',
  {
    BVN: '12345678901',
    PhoneNumber: '+2348012345678',
  },
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  }
);
```

---

## Additional Information Needed

### 1. Complete API Specification
Please provide the complete API specification including:
- All available endpoints
- Request/response schemas
- Error codes and their meanings
- Rate limiting information
- Retry policies

### 2. Example Requests
Please provide working example requests for:
- Token acquisition
- BVN verification
- TIN verification
- Account verification
- Consent management

### 3. Testing Credentials
- Are there test BVN/TIN numbers we can use in CERTIFICATION?
- Should we use real credentials or mock data for testing?

### 4. Environment Transition
- What is the process for moving from CERTIFICATION to PRODUCTION?
- Are there different credentials for PRODUCTION?
- What are the PRODUCTION endpoint URLs?

---

## Current Error Logs

```
2026-04-07 08:57:44:5744 info: Requesting new BIVS access token {
  "clientId": "***aad2",
  "baseUrl": "https://apitest.nibss-plc.com.ng:1443"
}

2026-04-07 08:57:45:5745 warn: OAuth2 token request failed, trying Basic Auth {
  "error": "Request failed with status code 401",
  "status": 401
}

2026-04-07 08:57:45:5745 error: Failed to obtain BIVS access token {
  "error": "Request failed with status code 401",
  "status": 401
}

2026-04-07 08:57:45:5745 error: BVN verification error {
  "bvn": "***4321",
  "error": "BIVS authentication failed: Request failed with status code 401"
}
```

---

## Contact Information

**Company**: [Your Company Name]
**Integration Lead**: [Your Name]
**Email**: [Your Email]
**Phone**: [Your Phone Number]
**Project**: Sochatoa API - KYC/AML Verification System

---

## Expected Timeline

We are targeting to complete the NIBSS integration within:
- **Development/Testing**: Current phase
- **Production Deployment**: [Target Date]

Please advise on the expected turnaround time for resolving these authentication issues.

---

## Next Steps

Once we receive responses to the above questions:
1. Update authentication implementation based on correct method
2. Test token acquisition and API calls
3. Implement full BVN/TIN verification workflow
4. Test consent management integration
5. Proceed to PRODUCTION environment setup

---

## Appendix: Files Requiring NIBSS Integration

1. `/src/integrations/nibss/nibss.client.ts` - Main NIBSS API client
2. `/src/modules/auth/services/bvn.service.ts` - BVN verification service
3. `/src/modules/auth/services/tin.service.ts` - TIN verification service
4. `/src/integrations/nibss/examples/transaction-integration.example.ts` - Usage examples

---

**Generated**: April 7, 2026
**Last Updated**: April 7, 2026
**Status**: Awaiting NIBSS Support Response
