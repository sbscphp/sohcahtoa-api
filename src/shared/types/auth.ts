export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  sessionId: string;
  iat?: number;
  exp?: number;
}

export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  ADMIN = 'ADMIN',
  COMPLIANCE_OFFICER = 'COMPLIANCE_OFFICER',
  OPERATIONS = 'OPERATIONS',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export enum CustomerType {
  NIGERIAN_CITIZEN = 'NIGERIAN_CITIZEN',
  TOURIST = 'TOURIST',
  EXPATRIATE = 'EXPATRIATE',
  AGENT = 'AGENT',
}

export enum KycStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

export interface SignupRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

export interface NigerianSignupRequest {
  bvn: string;
}

export interface TouristSignupRequest {
  passportDocumentUrl: string;
  passportNumber?: string;
}

export interface ExpatriateSignupRequest {
  passportDocumentUrl: string;
  passportNumber?: string;
}

export interface BvnVerificationResponse {
  bvnVerified: boolean;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  phoneNumber?: string;
  address?: string;
  message: string;
}

export interface OtpRequest {
  email: string;
  phoneNumber: string;
  purpose: OtpPurpose;
}

export enum OtpPurpose {
  REGISTRATION = 'REGISTRATION',
  LOGIN = 'LOGIN',
  PASSWORD_RESET = 'PASSWORD_RESET',
  TRANSACTION_VERIFICATION = 'TRANSACTION_VERIFICATION',
}

export interface OtpValidationRequest {
  email?: string;
  otp: string;
  purpose: OtpPurpose;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  role: UserRole;
  customerType?: CustomerType;
  kycStatus: KycStatus;
  isActive: boolean;
  createdAt: string;
}

export interface KycVerificationRequest {
  userId: string;
  bvn?: string;
  tin?: string;
  passportNumber?: string;
}
