import jwt, { SignOptions, TokenExpiredError, JsonWebTokenError, NotBeforeError } from 'jsonwebtoken';
import { JwtPayload } from '../types';

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || 'your-access-secret-key';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const MOBILE_ACCESS_TOKEN_EXPIRY = process.env.JWT_MOBILE_ACCESS_EXPIRY || '1h';
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

export const generateAccessToken = (payload: JwtPayload, expiresIn?: string): string => {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: expiresIn || ACCESS_TOKEN_EXPIRY,
  } as SignOptions);
};

export const generateRefreshToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  } as SignOptions);
};

export const verifyAccessToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, ACCESS_TOKEN_SECRET) as JwtPayload;
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      throw new Error('TOKEN_EXPIRED');
    }
    if (error instanceof NotBeforeError) {
      throw new Error('TOKEN_NOT_YET_VALID');
    }
    // JsonWebTokenError — bad signature, malformed, wrong secret, etc.
    throw new Error('TOKEN_INVALID');
  }
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, REFRESH_TOKEN_SECRET) as JwtPayload;
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      throw new Error('TOKEN_EXPIRED');
    }
    throw new Error('TOKEN_INVALID');
  }
};

export const decodeToken = (token: string): JwtPayload | null => {
  try {
    return jwt.decode(token) as JwtPayload;
  } catch (error) {
    return null;
  }
};

/**
 * Detect if the user agent indicates a mobile device
 */
export const isMobileDevice = (userAgent?: string): boolean => {
  if (!userAgent) return false;

  const mobilePatterns = [
    /Android/i,
    /webOS/i,
    /iPhone/i,
    /iPad/i,
    /iPod/i,
    /BlackBerry/i,
    /Windows Phone/i,
    /Mobile/i,
  ];

  return mobilePatterns.some(pattern => pattern.test(userAgent));
};

/**
 * Get the appropriate access token expiry based on device type
 */
export const getAccessTokenExpiry = (userAgent?: string): string => {
  return isMobileDevice(userAgent) ? MOBILE_ACCESS_TOKEN_EXPIRY : ACCESS_TOKEN_EXPIRY;
};
