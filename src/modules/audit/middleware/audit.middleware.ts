import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import auditService from '../services/audit.service';
import { AuthRequest } from '../../../shared/middleware/auth';

/**
 * Routes that should be excluded from HTTP audit logging
 * (health checks, static assets, swagger docs)
 */
const EXCLUDED_PATHS = ['/health', '/api-docs', '/favicon.ico'];

/**
 * HTTP methods that mutate state — always audited.
 * GET/HEAD are audited only when they touch sensitive resources.
 */
const ALWAYS_AUDIT_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Sensitive path prefixes whose GET requests should also be audited.
 */
const SENSITIVE_GET_PREFIXES = [
  '/api/admin',
  '/api/auth/profile',
  '/api/customer',
  '/api/documents',
];

function shouldAudit(req: Request): boolean {
  if (EXCLUDED_PATHS.some((p) => req.path.startsWith(p))) return false;
  if (ALWAYS_AUDIT_METHODS.includes(req.method)) return true;
  if (req.method === 'GET') {
    return SENSITIVE_GET_PREFIXES.some((p) => req.path.startsWith(p));
  }
  return false;
}

function resolveResourceInfo(req: Request): { resourceType: string; resourceId?: string } {
  // Derive resource type from the path segments, e.g. /api/auth → AUTH
  const segments = req.path.replace(/^\/api\//, '').split('/');
  const resourceType = (segments[0] || 'UNKNOWN').toUpperCase();
  // The second segment is often an ID when it looks like a UUID/numeric value
  const maybeId = segments[1];
  const resourceId =
    maybeId && /^[0-9a-f-]{8,}$/i.test(maybeId) ? maybeId : undefined;
  return { resourceType, resourceId };
}

/**
 * Express middleware that writes one AuditEvent per auditable HTTP request.
 * It hooks into res.finish so we capture the final status code.
 */
export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!shouldAudit(req)) return next();

  const startedAt = Date.now();
  const authReq = req as AuthRequest;
  const eventId = uuidv4();

  // Capture body snapshot early (before any middleware mutation).
  // Sensitive fields are redacted so they never reach the audit store.
  const sanitisedBody = sanitiseBody(req.body);

  res.on('finish', () => {
    const duration = Date.now() - startedAt;
    const { resourceType, resourceId } = resolveResourceInfo(req);

    const severity =
      res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARNING' : 'INFO';

    auditService
      .logHttpRequest({
        eventId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        userId: authReq.user?.userId,
        ipAddress: (req.headers['x-forwarded-for'] as string) || req.ip,
        userAgent: req.headers['user-agent'],
        correlationId: req.correlationId,
        resourceType,
        resourceId,
        requestBody: sanitisedBody,
        severity,
      })
      .catch(() => {
        // Audit failures must never crash the app
      });
  });

  next();
}

/**
 * Remove fields whose values must never be persisted.
 */
const REDACTED_FIELDS = new Set([
  'password',
  'confirmPassword',
  'currentPassword',
  'newPassword',
  'pin',
  'otp',
  'token',
  'secret',
  'cvv',
  'cardNumber',
  'bvn',
  'nin',
]);

function sanitiseBody(body: unknown): Record<string, unknown> | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    result[key] = REDACTED_FIELDS.has(key.toLowerCase()) ? '[REDACTED]' : value;
  }
  return result;
}
