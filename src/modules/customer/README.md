# Customer Transaction Module

This module provides customer-facing endpoints for creating and managing foreign exchange transactions.

## Overview

The customer transaction module allows customers to:
- Initiate new foreign exchange transactions
- Upload required documents (BVN, NIN, Passport, Visa, Form A, etc.)
- View current exchange rates
- Calculate transaction amounts
- Select pickup points for cash collection
- Track their transaction history

## Database Changes

### New Fields Added to `UserKyc` Model
- `nin` (String, unique): National Identification Number
- `ninVerified` (Boolean): NIN verification status

### New Document Types Added to `DocumentType` Enum
- `NIN`: National Identification Number document
- `RETURN_TICKET`: Return flight ticket
- `FORM_A_ID`: Form A Identification document
- `FORM_A_DOCUMENT`: Form A supporting document
- `CORPORATE_BODY_LETTER`: Corporate body letter (required for BTA)
- `PARTNER_INVITATION_LETTER`: Invitation letter from business partner (required for BTA)
- `OVERSEAS_MEDICAL_LETTER`: Letter from overseas doctor/hospital (required for MEDICAL)
- `MEMBERSHIP_CARD`: Professional body membership card/ID (required for PROFESSIONAL_BODY)

## API Endpoints

All endpoints require authentication via Bearer token.

### Base URL
```
/api/customer/transactions
```

### 1. Create Transaction
**POST** `/api/customer/transactions`

Creates a new foreign exchange transaction. Customers must provide BVN, NIN, and transaction details.

**Request Body (PTA Example):**
```json
{
  "type": "PTA",
  "currency": "USD",
  "amount": 5000,
  "purpose": "Business travel to United States",
  "destinationCountry": "United States",
  "bvn": "12345678901",
  "nin": "12345678901"
}
```

**Request Body (SCHOOL_FEES Example):**
```json
{
  "type": "SCHOOL_FEES",
  "currency": "USD",
  "amount": 15000,
  "purpose": "Tuition payment for Fall 2024 semester",
  "destinationCountry": "United States",
  "admissionType": "UNDERGRADUATE",
  "beneficiaryDetails": {
    "name": "University of Example",
    "accountNumber": "1234567890",
    "accountName": "University Bursar Account",
    "bankName": "Example International Bank",
    "iban": "US12345678901234567890"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "550e8400-e29b-41d4-a716-446655440000",
    "referenceNumber": "TXN-1708123456789-ABC123DEF",
    "status": "DRAFT",
    "currentStep": "PERSONAL_INFO",
    "requiredDocuments": [
      "BVN",
      "NIN",
      "PASSPORT",
      "VISA",
      "RETURN_TICKET",
      "FORM_A_ID",
      "FORM_A_DOCUMENT"
    ],
    "message": "Transaction initiated successfully. Please upload required documents to proceed."
  }
}
```

### 2. Upload Documents
**POST** `/api/customer/transactions/:transactionId/documents`

Upload required documents for a transaction.

**Content-Type:** `multipart/form-data`

**Form Data:**
- `documentType`: One of the valid document types (PASSPORT, VISA, NIN, BVN, FORM_A_ID, etc.)
- `files`: File upload (max 5 files, 5MB each)

**Supported Formats:**
- Images: JPEG, PNG, WEBP
- Documents: PDF, DOC, DOCX

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Documents uploaded successfully",
    "documents": [
      {
        "id": "doc-id",
        "type": "PASSPORT",
        "fileName": "passport.pdf",
        "fileUrl": "https://cloudinary.com/...",
        "verificationStatus": "PENDING",
        "uploadedAt": "2024-02-13T10:00:00Z"
      }
    ],
    "requiredDocuments": ["BVN", "NIN", "VISA", "RETURN_TICKET", ...]
  }
}
```

### 3. Get My Transactions
**GET** `/api/customer/transactions?page=1&limit=10`

Retrieve all transactions for the authenticated customer.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

### 4. Get Transaction Details
**GET** `/api/customer/transactions/:transactionId`

Get detailed information about a specific transaction including all documents and step history.

### 5. Get Active Exchange Rates
**GET** `/api/customer/transactions/rates?currency=USD`

Retrieve current active exchange rates.

**Query Parameters:**
- `currency` (optional): Filter by currency code

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "rate-id",
      "fromCurrency": "USD",
      "toCurrency": "NGN",
      "buyRate": 1450.50,
      "sellRate": 1465.75,
      "validFrom": "2024-02-13T00:00:00Z",
      "validUntil": "2024-02-14T00:00:00Z"
    }
  ]
}
```

### 6. Calculate Transaction Amount
**POST** `/api/customer/transactions/rates/calculate`

Calculate the Naira equivalent for a foreign currency amount.

**Request Body:**
```json
{
  "currency": "USD",
  "amount": 5000
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "currency": "USD",
    "foreignAmount": 5000,
    "exchangeRate": 1465.75,
    "nairaEquivalent": 7328750,
    "rateValidUntil": "2024-02-14T00:00:00Z"
  }
}
```

### 7. Get Pickup Points
**GET** `/api/customer/transactions/pickup-points`

Retrieve list of all available cash pickup locations.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "outlet-id",
      "name": "Lagos Island Outlet",
      "location": "Lagos",
      "address": "123 Marina Street, Lagos Island",
      "branch": "LAGOS_ISLAND"
    }
  ]
}
```

## Required Documents by Transaction Type

### PTA (Personal Travel Allowance)
- BVN
- NIN
- PASSPORT
- VISA
- RETURN_TICKET
- FORM_A_ID
- FORM_A_DOCUMENT

### BTA (Business Travel Allowance)
**Note: BTA requires TIN instead of NIN, plus corporate documents**
- BVN
- TIN (Tax Identification Number)
- PASSPORT
- VISA
- RETURN_TICKET
- FORM_A_ID
- FORM_A_DOCUMENT
- CORPORATE_BODY_LETTER
- PARTNER_INVITATION_LETTER

### SCHOOL_FEES
**Simplified Requirements - Bank details captured separately**
- FORM_A_ID
- FORM_A_DOCUMENT

**Additional Required Information:**
- Admission Type (UNDERGRADUATE, POSTGRADUATE, OTHER)
- Currency and Amount (from rate calculator)
- Bank Details:
  - Bank Name
  - Account Number
  - Account Name
  - IBAN

### MEDICAL
**Same as PTA requirements plus Utility Bill and Medical Letters - Bank details required instead of pickup location**
- BVN
- NIN
- PASSPORT
- VISA
- RETURN_TICKET
- FORM_A_ID
- FORM_A_DOCUMENT
- UTILITY_BILL
- MEDICAL_LETTER (Letter from local doctor)
- OVERSEAS_MEDICAL_LETTER (Letter from overseas doctor/hospital)

**Additional Required Information:**
- Currency and Amount (from rate calculator)
- Bank Details (for payment to medical institution):
  - Bank Name
  - Account Number
  - Account Name
  - IBAN

### PROFESSIONAL_BODY
**Simplified Requirements - Bank details required for payment to professional body**
- BVN
- FORM_A_ID
- FORM_A_DOCUMENT
- UTILITY_BILL
- MEMBERSHIP_CARD (Professional body membership card/ID)
- INVOICE (Invoice from professional body)

**Additional Required Information:**
- Currency and Amount (from rate calculator)
- Bank Details (for payment to professional body):
  - Bank Name
  - Account Number
  - Account Name
  - IBAN

### Other Transaction Types
Different requirements apply for TOURIST_FX, RESIDENT_FX, EXPATRIATE_FX, IMTO_REMITTANCE, and CASH_REMITTANCE.

## Transaction Flow

1. **Create Transaction** - Customer initiates with BVN, NIN, and transaction details
2. **Upload Documents** - Customer uploads all required documents
3. **Document Verification** - System verifies uploaded documents
4. **Amount Calculation** - Rate is locked and amount calculated
5. **Compliance Check** - Automated compliance verification
6. **Admin Review** - Manual review by admin team
7. **Disbursement** - Funds disbursed via selected method

## Migration Instructions

To apply the database schema changes, run:

```bash
npx prisma migrate dev --name add_nin_and_form_a_documents
```

Or if using pnpm:

```bash
pnpm prisma migrate dev --name add_nin_and_form_a_documents
```

This will:
1. Add the `nin` and `ninVerified` fields to the `UserKyc` table
2. Add new document types to the `DocumentType` enum

## Testing

Use the Swagger UI at `/api-docs` to test all endpoints interactively.

**Example Test Flow:**

1. **Login** to get authentication token
2. **Create a transaction** with test BVN/NIN
3. **Upload documents** one by one
4. **Check rates** before finalizing
5. **View transaction status** to track progress

## Error Handling

All endpoints return standardized error responses:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid transaction type"
  }
}
```

Common error codes:
- `VALIDATION_ERROR`: Invalid input data
- `NOT_FOUND`: Resource not found
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
