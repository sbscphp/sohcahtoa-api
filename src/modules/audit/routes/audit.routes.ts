import { Router } from 'express';
import { authenticate, authorize } from '../../../shared/middleware';
import { UserRole } from '../../../shared/types';
import { auditController } from '../controllers/audit.controller';

export const AuditRouter: Router = Router();

// All audit endpoints require authentication.
// Most are restricted to SUPER_ADMIN / ADMIN; compliance timeline is also
// open to COMPLIANCE_OFFICER.

const adminOnly = [authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN)];
const adminOrCompliance = [
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER),
];

/**
 * @swagger
 * tags:
 *   name: Audit
 *   description: Audit trail, security events, and analytics (admin only)
 */

// ── Audit events ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/audit/events:
 *   get:
 *     summary: Query audit events
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: eventType, schema: { type: string } }
 *       - { in: query, name: category, schema: { type: string, enum: [AUTHENTICATION, TRANSACTION, PAYMENT, COMPLIANCE, ADMIN, SYSTEM] } }
 *       - { in: query, name: userId, schema: { type: string, format: uuid } }
 *       - { in: query, name: resourceType, schema: { type: string } }
 *       - { in: query, name: resourceId, schema: { type: string } }
 *       - { in: query, name: severity, schema: { type: string, enum: [INFO, WARNING, ERROR, CRITICAL] } }
 *       - { in: query, name: correlationId, schema: { type: string } }
 *       - { in: query, name: startDate, schema: { type: string, format: date-time } }
 *       - { in: query, name: endDate, schema: { type: string, format: date-time } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 50, maximum: 200 } }
 *     responses:
 *       200: { description: Audit events retrieved }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 */
AuditRouter.get('/events', ...adminOnly, auditController.listEvents.bind(auditController));

/**
 * @swagger
 * /api/audit/events/{id}:
 *   get:
 *     summary: Get a single audit event by ID
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Audit event retrieved }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 */
AuditRouter.get('/events/:id', ...adminOnly, auditController.getEvent.bind(auditController));

// ── Security events ─────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/audit/security:
 *   get:
 *     summary: List security events
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: eventType, schema: { type: string } }
 *       - { in: query, name: severity, schema: { type: string, enum: [INFO, WARNING, ERROR, CRITICAL] } }
 *       - { in: query, name: userId, schema: { type: string } }
 *       - { in: query, name: resolved, schema: { type: boolean } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 50, maximum: 200 } }
 *     responses:
 *       200: { description: Security events retrieved }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 */
AuditRouter.get('/security', ...adminOnly, auditController.listSecurityEvents.bind(auditController));

/**
 * @swagger
 * /api/audit/security/summary:
 *   get:
 *     summary: Security events summary (unresolved, grouped by type/severity)
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Security summary retrieved }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 */
AuditRouter.get('/security/summary', ...adminOnly, auditController.securitySummary.bind(auditController));

/**
 * @swagger
 * /api/audit/security/{id}/resolve:
 *   patch:
 *     summary: Mark a security event as resolved
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [resolvedBy]
 *             properties:
 *               resolvedBy: { type: string }
 *     responses:
 *       200: { description: Security event resolved }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 */
AuditRouter.patch('/security/:id/resolve', ...adminOnly, auditController.resolveSecurityEvent.bind(auditController));

// ── Stats / analytics ───────────────────────────────────────────────────────

/**
 * @swagger
 * /api/audit/stats:
 *   get:
 *     summary: Audit dashboard stats (event counts by category/severity)
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: hours, schema: { type: integer, default: 24 } }
 *     responses:
 *       200: { description: Stats retrieved }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 */
AuditRouter.get('/stats', ...adminOnly, auditController.getStats.bind(auditController));

/**
 * @swagger
 * /api/audit/stats/event-types:
 *   get:
 *     summary: Top N most frequent event types in the given window
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: hours, schema: { type: integer, default: 24 } }
 *       - { in: query, name: topN, schema: { type: integer, default: 20 } }
 *     responses:
 *       200: { description: Event type frequency retrieved }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 */
AuditRouter.get('/stats/event-types', ...adminOnly, auditController.getEventTypeFrequency.bind(auditController));

/**
 * @swagger
 * /api/audit/stats/volume:
 *   get:
 *     summary: Hourly event volume (for time-series charts)
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: hours, schema: { type: integer, default: 24 } }
 *     responses:
 *       200: { description: Volume data retrieved }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 */
AuditRouter.get('/stats/volume', ...adminOnly, auditController.getHourlyVolume.bind(auditController));

// ── User activity ───────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/audit/users/{userId}/activity:
 *   get:
 *     summary: Full audit trail for a specific user
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: userId, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: category, schema: { type: string } }
 *       - { in: query, name: startDate, schema: { type: string, format: date-time } }
 *       - { in: query, name: endDate, schema: { type: string, format: date-time } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 50, maximum: 200 } }
 *     responses:
 *       200: { description: User activity retrieved }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 */
AuditRouter.get('/users/:userId/activity', ...adminOnly, auditController.getUserActivity.bind(auditController));

// ── Resource history ────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/audit/resources/{resourceType}/{resourceId}:
 *   get:
 *     summary: Complete change log for any entity
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: resourceType, required: true, schema: { type: string }, example: TRANSACTION }
 *       - { in: path, name: resourceId, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 50, maximum: 200 } }
 *     responses:
 *       200: { description: Resource history retrieved }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 */
AuditRouter.get('/resources/:resourceType/:resourceId', ...adminOrCompliance, auditController.getResourceHistory.bind(auditController));

// ── Compliance timeline ─────────────────────────────────────────────────────

/**
 * @swagger
 * /api/audit/compliance/timeline:
 *   get:
 *     summary: Compliance event timeline (optionally scoped to a transaction)
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: transactionId, schema: { type: string, format: uuid } }
 *       - { in: query, name: userId, schema: { type: string, format: uuid } }
 *       - { in: query, name: startDate, schema: { type: string, format: date-time } }
 *       - { in: query, name: endDate, schema: { type: string, format: date-time } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 50, maximum: 200 } }
 *     responses:
 *       200: { description: Compliance timeline retrieved }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 */
AuditRouter.get('/compliance/timeline', ...adminOrCompliance, auditController.getComplianceTimeline.bind(auditController));

// ── Correlation trace ───────────────────────────────────────────────────────

/**
 * @swagger
 * /api/audit/trace/{correlationId}:
 *   get:
 *     summary: Reconstruct the full request flow for a correlation ID
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: correlationId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Correlation trace retrieved }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 */
AuditRouter.get('/trace/:correlationId', ...adminOnly, auditController.getCorrelationTrace.bind(auditController));

// ── Legacy compatibility ────────────────────────────────────────────────────
// Keep old paths working so existing integrations don't break.

AuditRouter.get('/trail', ...adminOnly, auditController.listEvents.bind(auditController));
AuditRouter.get('/trail/user/:userId', ...adminOnly, auditController.getUserActivity.bind(auditController));
AuditRouter.get('/trail/:resourceType/:resourceId', ...adminOrCompliance, auditController.getResourceHistory.bind(auditController));
AuditRouter.get('/security-events', ...adminOnly, auditController.listSecurityEvents.bind(auditController));
