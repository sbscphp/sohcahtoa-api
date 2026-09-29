# NIBSS Integration Documentation

## Overview

This module integrates with **NIBSS (Nigeria Inter-Bank Settlement System)** for BVN/NIN verification, TIN verification, bank account verification, and consent management. The client lives at [nibss.client.ts](nibss.client.ts) and is consumed primarily through [bvn.service.ts](../../modules/auth/services/bvn.service.ts) and [tin.service.ts](../../modules/auth/services/tin.service.ts).

NIBSS exposes several distinct products behind this one client, each with its own credentials, base URL, and token flow:

| Service | Purpose | Token flow |
|---|---|---|
| **BIVS** | TIN verification, bank account verification, bank list, TIN Identity v2 | `client_credentials` |
| **Consent Hub** | Initiate/poll consent for BVN or NIN data access; returns a `retrievalToken` | `client_credentials` |
| **FAS** (Financial Authentication Service) | BVN/NIN data extraction using a Consent Hub `retrievalToken` | `client_credentials` (falls back to Consent Hub credentials if FAS-specific ones aren't set) |
| **iGree** (BVN Consent v1) | OIDC-based BVN consent + retrieval — **two separate NIBSS app registrations**, see below | `authorization_code` (consent) + `client_credentials` (retrieval) |

## iGree: two phases, possibly one credential set

iGree is the odd one out and is the most common source of confusion, so it's called out on its own. It has **two phases, using two different grant types**:

1. **Consent phase** (`iGreeGetAuthUrl` → `iGreeExchangeCode`) — the user is redirected to NIBSS's IdP to authenticate and consent. The authorization code returned on callback is exchanged for an access/id token using `NIBSS_IGREE_CLIENT_ID` / `NIBSS_IGREE_CLIENT_SECRET` (`authorization_code` grant). The `id_token` JWT is verified against NIBSS's published JWKS and its `bvn` claim is extracted — this is the BVN the retrieval phase will fetch.
2. **Retrieval phase** (`iGreeGetBvnDetails`) — a `client_credentials` grant is used to call `POST /getPartialDetailsWithBvn`. This token is **not** derived from or related to the consent-phase user's session — it authenticates the calling app itself, independent of any particular user's consent.

Both phases' tokens come from the **same oxAuth IdP** at `NIBSS_IDP_BASE_URL` (`{idpBaseUrl}/oxauth/restv1/token`) — a different server from the Azure AD-backed `/reset` endpoint used by BIVS/Consent Hub/FAS; don't point `NIBSS_IGREE_RETRIEVAL_RESET_URL` at `/reset` — it will 401 with no error body since the request never reaches Azure AD at all.

NIBSS's docs describe the retrieval phase as its own app registration (`NIBSS_IGREE_RETRIEVAL_CLIENT_ID`/`SECRET`), and the client supports that if NIBSS has issued one for you. **In the sandbox tenant this repo talks to, no such registration exists** — a `NIBSS_IGREE_RETRIEVAL_CLIENT_ID` value was configured but oxAuth rejects it with `invalid_client`, while the consent-phase client_id/secret authenticate fine there for `client_credentials` too. So `iGreeRetrievalClientId`/`Secret`/`ConsumerCustomId` all fall back to the consent-phase credentials when the retrieval-specific env vars are unset — leave them unset unless NIBSS confirms they've issued a real separate retrieval registration for your account.

## Environment Configuration

```bash
# ─── BIVS (TIN verification, account verification, bank list) ───
NIBSS_BIVS_CLIENT_ID=
NIBSS_BIVS_CLIENT_SECRET=
NIBSS_BIVS_BASE_URL=https://apitest.nibss-plc.com.ng
NIBSS_BIVS_RESET_URL=https://apitest.nibss-plc.com.ng/reset
NIBSS_BIVS_CLIENT_USERNAME=            # Base64'd into the Signature field for TIN Identity v2
NIBSS_TIN_BASE_URL=https://apitest.nibss-plc.com.ng/identity/v2

# ─── Consent Hub / FAS (share credentials unless FAS-specific ones are set) ───
NIBSS_CONSENT_CLIENT_ID=
NIBSS_CONSENT_CLIENT_SECRET=
NIBSS_CONSENT_RESET_URL=https://apitest.nibss-plc.com.ng/reset
NIBSS_CONSENT_HUB_BASE_URL=https://apitest.nibss-plc.com.ng/api
NIBSS_CONSENT_STATUS_BASE_URL=          # optional override; status endpoint can live on a different host
NIBSS_DATA_CONTROLLER_ID=d6378b2e-092f-485a-a1f9-f97b3ca8c3f3
NIBSS_CALLBACK_URL=                     # where NIBSS redirects after RedirectLink consent

# FAS-specific credentials — optional. If unset, FAS falls back to the Consent Hub
# credentials above. Set these if NIBSS issues FAS its own app registration.
NIBSS_FAS_CLIENT_ID=
NIBSS_FAS_CLIENT_SECRET=
NIBSS_FAS_RESET_URL=
NIBSS_FAS_BASE_URL=https://apitest.nibss-plc.com.ng/cvs/v2
NIBSS_FAS_SUBCLASS=1
NIBSS_FAS_RETRY=1
NIBSS_INSTITUTION_CODE=

# ─── iGree (BVN Consent v1) — consent phase ───
NIBSS_IGREE_BASE_URL=https://apitest.nibss-plc.com.ng/bvnconsent/v1
NIBSS_IDP_BASE_URL=https://idsandbox.nibss-plc.com.ng
NIBSS_IGREE_CLIENT_ID=
NIBSS_IGREE_CLIENT_SECRET=
NIBSS_IGREE_REDIRECT_URI=
NIBSS_IGREE_JWKS_URI=                   # optional override; otherwise resolved via OIDC discovery

# ─── iGree — retrieval phase (leave unset unless NIBSS issued a separate app for you, see above) ───
NIBSS_IGREE_RETRIEVAL_CLIENT_ID=        # falls back to NIBSS_IGREE_CLIENT_ID if unset
NIBSS_IGREE_RETRIEVAL_CLIENT_SECRET=    # falls back to NIBSS_IGREE_CLIENT_SECRET if unset
NIBSS_IGREE_RETRIEVAL_RESET_URL=https://idsandbox.nibss-plc.com.ng/oxauth/restv1/token   # defaults to {NIBSS_IDP_BASE_URL}/oxauth/restv1/token
NIBSS_IGREE_RETRIEVAL_SCOPE=            # optional; omitted from the token request if unset
NIBSS_IGREE_CONSUMER_CUSTOM_ID=         # falls back to iGreeRetrievalClientId (which itself falls back to NIBSS_IGREE_CLIENT_ID) if unset
NIBSS_IGREE_CHANNEL_CODE=02
```

## Usage Examples

### BVN via Consent Hub + FAS

```typescript
import bvnService from '@/modules/auth/services/bvn.service';

// 1. Kick off a Consent Hub session — returns a consentUrl to redirect the user to
const { sessionId, consentUrl } = await bvnService.initiateConsentForBvn('12345678901');

// 2. After the user completes consent (via redirect callback or by polling), you have
//    a retrievalToken. Complete the FAS lookup with it:
const result = await bvnService.verifyBvnWithRetrievalToken('12345678901', retrievalToken);
if (result.success) {
  console.log(result.data?.firstName, result.data?.lastName);
}

// If the redirect callback never arrives, poll instead:
const status = await bvnService.checkConsentStatus(sessionId!);
if (status.granted) {
  await bvnService.verifyBvnWithRetrievalToken('12345678901', status.retrievalToken!);
}
```

### BVN via iGree (OIDC consent, then a separate frontend-triggered retrieval step)

iGree is split into three steps precisely because NIBSS's data-fetch endpoint has been observed
to be flaky (intermittent 503s) even when auth succeeds — separating "consent verified" from
"details fetched" means a failed fetch can be retried without re-running the OAuth dance or
sending the customer back through NIBSS's consent portal.

```typescript
import bvnService from '@/modules/auth/services/bvn.service';

// 1. Build the IdP authorization URL and redirect the user
const { authUrl } = bvnService.initiateIGreeConsent(state);

// 2. NIBSS redirects back to NIBSS_IGREE_REDIRECT_URI with ?code=...&state=...
//    Exchange the code (consent-phase credentials), extract the verified bvn from the id_token,
//    and obtain (but don't yet use) the retrieval-phase token. Persist both against the session.
const { bvn, retrievalToken } = await bvnService.exchangeIGreeConsentCode(code);

// 3. Frontend-triggered, once the session is known to be consent-verified: fetch full BVN
//    details using the (already-obtained, cached-in-client) retrieval token.
const result = await bvnService.getIGreeBvnDetails(bvn);
if (result.success) {
  console.log(result.data?.firstName, result.data?.lastName);
}
```

See `auth.service.ts`'s `handleIGreeCallback` (Step 2) and `retrieveIGreeBvnDetails` (Step 3) for
how this is wired into the actual signup flow, including session persistence and identity
cross-validation.

### Boolean BVN match (no consent flow required)

```typescript
import bvnService from '@/modules/auth/services/bvn.service';

const result = await bvnService.verifyBvnBoolean('12345678901', {
  firstname: 'John',
  lastname: 'Doe',
  middlename: '',
  phone_no: '+2348012345678',
  dob: '1990-01-15',
  gender: 'M',
});

console.log(result.matches); // { firstnameMatch, lastnameMatch, dobMatch, ... }
```

### TIN Verification

```typescript
import { nibssClient } from '@/integrations/nibss/nibss.client';

// Legacy BIVS TIN verification
const result = await nibssClient.verifyTin({ TIN: '12345678', FullName: 'Acme Corporation Ltd' });

// TIN Identity v2
const individual = await nibssClient.verifyIndividualTin('12345678');
const corporate  = await nibssClient.verifyCorporateTin('12345678');
```

### Account Verification / Bank List

```typescript
import { nibssClient } from '@/integrations/nibss/nibss.client';

const account = await nibssClient.verifyAccount('0123456789', '058');
const banks   = await nibssClient.getBankList();
```

## Authentication

Every service manages its own token, cached in-memory and refreshed 5 minutes before expiry:

| Method | Grant | Credentials |
|---|---|---|
| `getBivsToken()` | `client_credentials` | `NIBSS_BIVS_CLIENT_ID`/`SECRET` |
| `getConsentToken()` | `client_credentials` | `NIBSS_CONSENT_CLIENT_ID`/`SECRET` |
| `getFasToken()` | `client_credentials` | `NIBSS_FAS_CLIENT_ID`/`SECRET`, falling back to Consent Hub credentials |
| iGree consent exchange | `authorization_code` | `NIBSS_IGREE_CLIENT_ID`/`SECRET` (tries HTTP Basic Auth first, falls back to `client_secret_post` if the IdP rejects it) |
| `getIGreeRetrievalToken()` | `client_credentials` | `NIBSS_IGREE_RETRIEVAL_CLIENT_ID`/`SECRET` |

To force a refresh (e.g. after rotating secrets):

```typescript
import { nibssClient } from '@/integrations/nibss/nibss.client';

nibssClient.resetTokens();
```

## Response Codes

| Code | Meaning |
|------|---------|
| `00` | Success |
| `01` | Invalid request |
| `02` | Record not found |
| `03` | Unauthorized |
| `25` | No contact info on record (Consent Hub — non-fatal for `OfflineConsent`, the session is still created) |
| `99` | System error |

## Logging

- BVN/TIN/NIN values are masked in logs (e.g. `***8901`).
- Tokens and secrets are never logged.
- Request/response interceptors log at INFO; failures log at ERROR with response body and, for 401s, response headers (useful for diagnosing which credential set NIBSS rejected).

## Troubleshooting

**401 on FAS but Consent Hub works fine** — FAS may require its own app registration distinct from Consent Hub. Set `NIBSS_FAS_CLIENT_ID`/`NIBSS_FAS_CLIENT_SECRET`; the client logs an explicit warning pointing at this when it detects the fallback credentials were used and got rejected.

**iGree consent redirect works but `iGreeGetBvnDetails` 401s** — the retrieval phase uses a separate app registration from the consent phase. Confirm `NIBSS_IGREE_RETRIEVAL_CLIENT_ID`/`SECRET` are set to the retrieval app's credentials, not the consent app's (see "iGree: two credential sets, not one" above). Also confirm `NIBSS_IGREE_RETRIEVAL_RESET_URL` points at the oxAuth IdP (`{NIBSS_IDP_BASE_URL}/oxauth/restv1/token`), not the Azure AD-backed `/reset` used by BIVS/Consent Hub/FAS — pointing it at `/reset` produces a bare 401 with no response body (the request never reaches Azure AD), as opposed to a proper `AADSTS...` error.

**iGree token exchange (consent or retrieval) fails with 400/401 on Basic Auth** — the client automatically retries with `client_secret_post` (credentials in the request body instead of the `Authorization` header); some NIBSS environments expect this. If both fail, the credentials or redirect URI are likely wrong.

**`id_token` claims not trusted / `bvn` missing** — the id_token's signature is verified against NIBSS's published JWKS before its claims are used. If JWKS resolution fails (`NIBSS_IGREE_JWKS_URI` unset and OIDC discovery unreachable), verification is skipped and `bvn` will be `undefined` rather than falling back to unverified decoding — check logs for `iGree: no jwks_uri available`.

**`bvn` still missing from the id_token even though verification succeeded** — this is expected. NIBSS's oxAuth (Gluu) server doesn't embed custom-scope claims like `bvn` directly into the id_token by default; they're only released via the UserInfo endpoint (`{idpBaseUrl}/oxauth/restv1/userinfo`). `iGreeExchangeCode` automatically falls back to calling UserInfo with the access_token when the id_token has no `bvn`/`BVN` claim. If `bvn` is still missing after that (logged as `iGree: UserInfo response did not include a bvn claim either`, with the actual claim keys NIBSS returned), the `bvn` scope likely isn't configured to release that claim for this client registration — that needs to be fixed on NIBSS's side (Devportal/app registration), not in this code.

## Compliance

- **CBN KYC Requirements**: BVN verification for customer onboarding.
- **FIRS Tax Compliance**: TIN verification for tax reporting.
- **Data Protection**: Consent Hub / iGree consent flows for NDPR compliance.
- **AML/CFT**: Watchlist flag returned alongside BVN/NIN data.

## Additional Resources

- [NIBSS Official Documentation](https://nibss-plc.com.ng)
- [CBN Guidelines on KYC](https://www.cbn.gov.ng)
- [FIRS Tax Identification](https://www.firs.gov.ng)
