import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

/**
 * Correlation ID Middleware
 * Adds a unique correlation ID to each request for tracing across services
 */
export const correlationIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Check if correlation ID already exists in headers (from upstream service)
  const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();

  // Attach to request object
  req.correlationId = correlationId;

  // Add to response headers for client visibility
  res.setHeader('X-Correlation-ID', correlationId);

  next();
};
