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

# ─── iGree — retrieval phase (leave unset unless NIBSS issued a separate app for you, see above) ───
NIBSS_IGREE_RETRIEVAL_CLIENT_ID=        # falls back to NIBSS_IGREE_CLIENT_ID if unset
NIBSS_IGREE_RETRIEVAL_CLIENT_SECRET=    # falls back to NIBSS_IGREE_CLIENT_SECRET if unset
NIBSS_IGREE_RETRIEVAL_RESET_URL=https://idsandbox.nibss-plc.com.ng/oxauth/restv1/token   # defaults to {NIBSS_IDP_BASE_URL}/oxauth/restv1/token
NIBSS_IGREE_RETRIEVAL_SCOPE=            # optional; omitted from the token request if unset
NIBSS_IGREE_CONSUMER_CUSTOM_ID=         # falls back to iGreeRetrievalClientId (which itself falls back to NIBSS_IGREE_CLIENT_ID) if unset
NIBSS_IGREE_CHANNEL_CODE=02
```

## Usage Examples

### BVN via iGree (OIDC consent, then a separate frontend-triggered retrieval step)

**This is the only supported BVN verification flow.** An earlier Consent Hub + FAS-based BVN flow
(`initiateConsentForBvn`/`verifyBvnWithRetrievalToken`/`checkConsentStatus` on `bvn.service.ts`,
the `/callback` webhook route) has been removed — it had no reachable entry point in any real
signup flow (only ever called from a since-deleted examples file) once iGree replaced it. The
underlying Consent Hub session mechanism (`nibssClient.initiateConsent`) is still used elsewhere
(TIN verification, see `tin.service.ts`), and FAS's boolean BVN match (below) is unrelated and
still supported — only the BVN *core-data* retrieval via Consent Hub was removed.

iGree is split into three steps precisely because NIBSS's data-fetch endpoint has been observed
to be flaky (intermittent 503s) even when auth succeeds — separating "consent verified" from
"details fetched" means a failed fetch can be retried without re-running the OAuth dance or
sending the customer back through NIBSS's consent portal.

The bvn looked up in Step 3 is the customer's **self-reported** value from Step 1, not something
extracted from NIBSS's token exchange — NIBSS doesn't release a `bvn` claim for our client
registration (neither via id_token nor UserInfo; confirmed `insufficient_scope`). Step 3's
cross-check of self-reported name/DOB against NIBSS's record for that bvn is what actually
verifies the customer.

```typescript
import bvnService from '@/modules/auth/services/bvn.service';

// 1. Build the IdP authorization URL and redirect the user
const { authUrl } = bvnService.initiateIGreeConsent(state);

// 2. NIBSS redirects back to NIBSS_IGREE_REDIRECT_URI with ?code=...&state=...
//    Exchange the code (proves OTP consent completed) and obtain the retrieval-phase token.
const { retrievalToken } = await bvnService.exchangeIGreeConsentCode(code);

// 3. Frontend-triggered: fetch full BVN details for the customer's self-reported bvn, using
//    the (already-obtained, cached-in-client) retrieval token.
const result = await bvnService.getIGreeBvnDetails(selfReportedBvn);
if (result.success) {
  console.log(result.data?.firstName, result.data?.lastName);
}
```

See `auth.service.ts`'s `handleIGreeCallback` (Step 1a) and `retrieveIGreeBvnDetails` (Step 1b)
for how this is wired into the actual signup flow, including session persistence and identity
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

**iGree consent redirect works but `iGreeGetBvnDetails` 401s** — first confirm `NIBSS_IGREE_RETRIEVAL_RESET_URL` points at the oxAuth IdP (`{NIBSS_IDP_BASE_URL}/oxauth/restv1/token`), not the Azure AD-backed `/reset` used by BIVS/Consent Hub/FAS — pointing it at `/reset` produces a bare 401 with no response body (the request never reaches Azure AD), as opposed to a proper `AADSTS...` error. If NIBSS has issued a genuinely separate retrieval app registration for your account, set `NIBSS_IGREE_RETRIEVAL_CLIENT_ID`/`SECRET` to those credentials (see "iGree: two phases, possibly one credential set" above) — otherwise leave them unset so the client falls back to the consent-phase credentials, which is what works in the sandbox tenant this repo was built against.

**iGree token exchange (consent or retrieval) fails with 400/401 on Basic Auth** — the client automatically retries with `client_secret_post` (credentials in the request body instead of the `Authorization` header); some NIBSS environments expect this. If both fail, the credentials or redirect URI are likely wrong.

**Why `exchangeIGreeConsentCode` doesn't return a `bvn`** (as of 2026-09-30) — NIBSS's oxAuth server doesn't release the `bvn` scope's claim to our iGree consent client (`NIBSS_IGREE_CLIENT_ID`) at all: confirmed absent from the id_token, and the UserInfo endpoint rejects it outright with `403 insufficient_scope` (check the `iGree: token exchange granted scope` log line — `grantedScope` never includes `bvn`, confirming NIBSS drops it server-side even though it's correctly requested at `/authorize`). This is a client/app-registration gap on NIBSS's side; raise it with their support (client_id, requested scope, and the `insufficient_scope` error) if you want it fixed there.

Rather than block the whole flow on that, `exchangeIGreeConsentCode` doesn't attempt to extract `bvn` from the exchange at all — it only proves the customer completed OTP consent on NIBSS's portal. Step 1a (`handleIGreeCallback` in `auth.service.ts`) uses the customer's self-reported `bvn` from Step 1 directly to drive Step 1b's `getPartialDetailsWithBvn` lookup, and Step 1b's cross-check of self-reported name/DOB against NIBSS's record for that bvn is the actual integrity guarantee. This mirrors a sibling service in the same system that never depended on NIBSS naming the bvn in the first place. If NIBSS ever does grant the `bvn` scope, wiring it back in would mean re-adding claim extraction to `iGreeExchangeCode` — nothing currently reads NIBSS's copy of it.

## Compliance

- **CBN KYC Requirements**: BVN verification for customer onboarding.
- **FIRS Tax Compliance**: TIN verification for tax reporting.
- **Data Protection**: Consent Hub / iGree consent flows for NDPR compliance.
- **AML/CFT**: Watchlist flag returned alongside BVN/NIN data.

## Additional Resources

- [NIBSS Official Documentation](https://nibss-plc.com.ng)
- [CBN Guidelines on KYC](https://www.cbn.gov.ng)
- [FIRS Tax Identification](https://www.firs.gov.ng)
