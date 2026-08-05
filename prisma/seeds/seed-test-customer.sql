-- =============================================================
-- Seed: Test Customer
-- Password: Test@1234
-- Hash below is bcrypt (rounds=10) of "Test@1234"
-- =============================================================

DO $$
DECLARE
  v_user_id   UUID := gen_random_uuid();
  v_wallet_id UUID := gen_random_uuid();
BEGIN

  -- ── 1. User ──────────────────────────────────────────────────
  INSERT INTO users (
    id, email, "phoneNumber", role, "customerType",
    "isActive", "emailVerified", "phoneVerified",
    "createdAt", "updatedAt"
  ) VALUES (
    v_user_id,
    'ada.okonkwo@example.com',
    '+2348012345678',
    'CUSTOMER',
    'NIGERIAN_CITIZEN',
    true, true, true,
    NOW(), NOW()
  );

  -- ── 2. Credentials ───────────────────────────────────────────
  -- Password: Test@1234
  INSERT INTO user_credentials (
    id, "userId", "passwordHash",
    "lastPasswordChange", "failedAttempts",
    "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lN26',
    NOW(), 0,
    NOW(), NOW()
  );

  -- ── 3. Profile ───────────────────────────────────────────────
  INSERT INTO user_profiles (
    id, "userId",
    "firstName", "lastName",
    "dateOfBirth", address, city, state, country, "postalCode",
    avatar,
    "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    'Ada', 'Okonkwo',
    '1992-03-15',
    '14B Admiralty Way',
    'Lagos',
    'Lagos',
    'Nigeria',
    '106104',
    NULL,
    NOW(), NOW()
  );

  -- ── 4. KYC ───────────────────────────────────────────────────
  INSERT INTO user_kyc (
    id, "userId", status,
    bvn, tin,
    "passportNumber", "passportIssueDate", "passportExpiryDate",
    "bvnVerified", "tinVerified", "passportVerified",
    "verificationNotes", "verifiedAt",
    "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    'VERIFIED',
    '22345678901',
    '12345678-0001',
    'A01234567',
    '2021-06-01',
    '2031-05-31',
    true, true, true,
    'All documents verified successfully.',
    NOW(),
    NOW(), NOW()
  );

  -- ── 5. Wallet ────────────────────────────────────────────────
  INSERT INTO customer_wallets (
    id, "userId", balance, currency, "isActive",
    "createdAt", "updatedAt"
  ) VALUES (
    v_wallet_id,
    v_user_id,
    0.00,
    'NGN',
    true,
    NOW(), NOW()
  );

  -- ── 6. Wallet entry (opening credit) ─────────────────────────
  INSERT INTO wallet_entries (
    id, "walletId", type, amount,
    "balanceBefore", "balanceAfter",
    description, status,
    "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid(),
    v_wallet_id,
    'CREDIT',
    0.00,
    0.00,
    0.00,
    'Opening balance — seed',
    'COMPLETED',
    NOW(), NOW()
  );

  -- ── 7. Bank account ──────────────────────────────────────────
  INSERT INTO customer_bank_accounts (
    id, "userId",
    "bankName", "accountNumber", "accountName",
    currency, "isVerified", "isDefault",
    "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    'Access Bank',
    '0123456789',
    'Ada Okonkwo',
    'NGN',
    true, true,
    NOW(), NOW()
  );

  -- ── 8. Notification preferences ──────────────────────────────
  INSERT INTO notification_preferences (
    id, "userId",
    "emailEnabled", "emailTransactional", "emailMarketing", "emailSecurity",
    "smsEnabled",   "smsTransactional",   "smsMarketing",   "smsSecurity",
    "pushEnabled",  "pushTransactional",  "pushMarketing",  "pushSecurity",
    "inAppEnabled",
    "quietHoursEnabled",
    "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    true, true, false, true,
    true, true, false, true,
    true, true, false, true,
    true,
    false,
    NOW(), NOW()
  );

  RAISE NOTICE 'Seeded test customer: id=%, email=ada.okonkwo@example.com, password=Test@1234', v_user_id;

END $$;
