import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { JwtPayload, UserRole } from '../types';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { createLogger } from '../utils/logger';

const logger = createLogger('AuthMiddleware');

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new UnauthorizedError('No token provided'));
    }

    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);

    req.user = decoded;
    next();
  } catch (error: any) {
    const reason = error?.message;

    if (reason === 'TOKEN_EXPIRED') {
      logger.warn('Access token expired', { path: req.path, method: req.method });
      return next(new UnauthorizedError('Token has expired. Please log in again.'));
    }

    if (reason === 'TOKEN_INVALID') {
      logger.warn('Invalid access token (bad signature or malformed)', { path: req.path, method: req.method });
      return next(new UnauthorizedError('Invalid token. Please log in again.'));
    }

    logger.warn('Token verification failed', { reason, path: req.path, method: req.method });
    return next(new UnauthorizedError('Authentication failed. Please log in again.'));
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
};

export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const decoded = verifyAccessToken(token);
      req.user = decoded;
    } catch (error) {
      // Token is invalid but we don't throw error for optional auth
    }
  }

  next();
};
