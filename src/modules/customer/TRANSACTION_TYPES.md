# Transaction Types and Document Requirements

This document outlines the different transaction types and their specific document requirements.

## Key Differences: PTA vs BTA

### PTA (Personal Travel Allowance)
**Purpose:** For individual/personal foreign travel expenses

**Required Documents:**
1. **BVN** - Bank Verification Number
2. **NIN** - National Identification Number (Individual ID)
3. **PASSPORT** - International passport
4. **VISA** - Valid visa for destination country
5. **RETURN_TICKET** - Return flight ticket
6. **FORM_A_ID** - Form A identification
7. **FORM_A_DOCUMENT** - Form A supporting document

**Use Cases:**
- Personal vacation travel
- Family visits abroad
- Individual medical treatment
- Personal education expenses

---

### BTA (Business Travel Allowance)
**Purpose:** For corporate/business foreign travel and transactions

**Required Documents:**
1. **BVN** - Bank Verification Number
2. **TIN** - Tax Identification Number (Corporate/Business tax ID, NOT NIN)
3. **PASSPORT** - International passport
4. **VISA** - Valid visa for destination country
5. **RETURN_TICKET** - Return flight ticket
6. **FORM_A_ID** - Form A identification
7. **FORM_A_DOCUMENT** - Form A supporting document
8. **CORPORATE_BODY_LETTER** - Letter from the corporate body/company
9. **PARTNER_INVITATION_LETTER** - Invitation letter from business partner abroad

**Key Differences from PTA:**
- ✅ Requires **TIN** instead of NIN (business tax identification)
- ✅ Requires **Corporate Body Letter** (company authorization)
- ✅ Requires **Partner Invitation Letter** (proof of business relationship)

**Use Cases:**
- Business meetings abroad
- Trade exhibitions/conferences
- Contract negotiations
- Corporate training
- Business partnerships

---

## Other Transaction Types

### SCHOOL_FEES
**Purpose:** Payment for international education

**Required Documents:**
- FORM_A_ID
- FORM_A_DOCUMENT

**Additional Required Information:**
- **Admission Type**: UNDERGRADUATE, POSTGRADUATE, or OTHER
- **Currency & Amount**: Retrieved from rate calculator endpoint
- **Bank Details** (for direct payment to institution):
  - Bank Name
  - Account Number
  - Account Name (Institution's account)
  - IBAN (International Bank Account Number)

**Key Notes:**
- Simplified document requirements - only Form A documents needed
- BVN, NIN, Passport, and Visa are NOT required
- Bank details must be for the educational institution receiving payment
- Amount should be verified using the rate calculator before submission

**Use Cases:**
- University tuition payments
- College application fees
- Education-related expenses abroad

---

### MEDICAL
**Purpose:** International medical treatment expenses

**Required Documents:**
Same as PTA requirements plus Utility Bill and Medical Letters:
- BVN
- NIN
- PASSPORT
- VISA
- RETURN_TICKET
- FORM_A_ID
- FORM_A_DOCUMENT
- UTILITY_BILL (Proof of residence)
- MEDICAL_LETTER (Letter from local doctor/medical professional)
- OVERSEAS_MEDICAL_LETTER (Letter from overseas doctor/hospital confirming appointment/treatment)

**Additional Required Information:**
- **Currency & Amount**: Retrieved from rate calculator endpoint
- **Bank Details** (for payment to medical institution):
  - Bank Name
  - Account Number
  - Account Name (Medical institution's account)
  - IBAN (International Bank Account Number)

**Key Notes:**
- Same document requirements as PTA with additional utility bill and medical letters
- Bank details required instead of pickup location
- **Two medical letters required**: one from local doctor (referral) and one from overseas hospital (confirmation)
- Utility bill serves as proof of residence
- Payment goes directly to medical institution

**Use Cases:**
- International medical treatment
- Overseas surgery expenses
- Medical consultation fees abroad

---

### PROFESSIONAL_BODY
**Purpose:** Professional association/body membership and fees

**Required Documents:**
- BVN
- FORM_A_ID
- FORM_A_DOCUMENT
- UTILITY_BILL (Proof of residence)
- MEMBERSHIP_CARD (Professional body membership card/ID)
- INVOICE (Invoice from professional body for membership fees)

**Additional Required Information:**
- **Currency & Amount**: Retrieved from rate calculator endpoint
- **Bank Details** (for payment to professional body):
  - Bank Name
  - Account Number
  - Account Name (Professional body's account)
  - IBAN (International Bank Account Number)

**Key Notes:**
- Simplified requirements - no NIN or Passport needed
- Utility bill serves as proof of residence
- Membership card proves current/pending membership
- Invoice must be from the professional body
- Payment goes directly to professional body via bank transfer
- Currency amount calculated using rate calculator

**Use Cases:**
- Annual membership renewal fees
- Professional certification payments
- Registration fees for international professional bodies

---

### TOURIST_FX
**Purpose:** Tourism-related foreign exchange

**Required Documents:**
- BVN
- NIN
- PASSPORT
- RETURN_TICKET
- FORM_A_ID
- FORM_A_DOCUMENT

---

### RESIDENT_FX
**Purpose:** Foreign exchange for residents

**Required Documents:**
- BVN
- NIN
- PASSPORT
- FORM_A_ID
- FORM_A_DOCUMENT

---

### EXPATRIATE_FX
**Purpose:** Foreign exchange for expatriates

**Required Documents:**
- PASSPORT
- VISA
- FORM_A_ID
- FORM_A_DOCUMENT

**Note:** Expatriates don't require BVN or NIN

---

### IMTO_REMITTANCE
**Purpose:** International Money Transfer Operator remittances

**Required Documents:**
- BVN
- NIN
- FORM_A_ID
- FORM_A_DOCUMENT

---

### CASH_REMITTANCE
**Purpose:** Cash-based remittances

**Required Documents:**
- BVN
- NIN
- FORM_A_ID
- FORM_A_DOCUMENT

---

## Implementation Notes

### Document Validation
The system automatically validates that all required documents are uploaded based on the transaction type selected during creation.

### API Response
When creating a transaction, the API returns a `requiredDocuments` array showing exactly which documents must be uploaded:

```json
{
  "transactionId": "...",
  "requiredDocuments": [
    "BVN",
    "TIN",
    "PASSPORT",
    "VISA",
    "RETURN_TICKET",
    "FORM_A_ID",
    "FORM_A_DOCUMENT",
    "CORPORATE_BODY_LETTER",
    "PARTNER_INVITATION_LETTER"
  ]
}
```

### Upload Process
Documents can be uploaded one at a time or in batches (max 5 files per upload). Each upload must specify the `documentType` to ensure proper categorization.

### Document Verification
Once uploaded, documents enter a verification workflow:
1. **PENDING** - Just uploaded
2. **IN_PROGRESS** - Being verified
3. **VERIFIED** - Approved
4. **FAILED** - Rejected
5. **REQUIRES_MANUAL_REVIEW** - Needs human review

---

## Compliance Notes

### CBN Requirements
All document requirements are based on Central Bank of Nigeria (CBN) foreign exchange regulations and guidelines.

### Form A
Form A is mandatory for all foreign exchange transactions and serves as:
- Official application for foreign exchange
- Declaration of the purpose of the transaction
- Compliance document for regulatory purposes

### BVN vs NIN vs TIN
- **BVN** (Bank Verification Number): Required for all Nigerian citizens' transactions
- **NIN** (National ID): Required for **personal** transactions (PTA, personal medical, etc.)
- **TIN** (Tax ID): Required for **business/corporate** transactions (BTA)

This distinction ensures proper categorization and compliance for personal vs. business foreign exchange transactions.
