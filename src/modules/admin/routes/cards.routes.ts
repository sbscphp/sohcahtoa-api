import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../shared/utils/async-handler';
import { authenticate, authorize } from '../../../shared/middleware/auth';
import { UserRole } from '../../../shared/types/auth';
import cardInfra from '../../payments/services/cardinfra.service';

const router = Router();
router.use(authenticate, authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OPERATIONS));

const uuid = z.string().uuid();
const amount = z.coerce.number().positive();
const txnQuery = z.object({
  cardId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data });

/**
 * @swagger
 * tags:
 *   name: admin-cards
 *   description: CardInfra FIP Prepaid card management (admin only)
 */

/** @swagger
 * /api/admin/cards/customers:
 *   post:
 *     summary: Onboard a customer with the card provider
 *     tags: [admin-cards]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/customers', asyncHandler(async (req: Request, res: Response) => {
  const body = z.object({
    firstName: z.string().min(1), middleName: z.string().optional(), lastName: z.string().min(1),
    email: z.string().email().nullish(), phone: z.string().min(1), nationality: z.string().min(1),
    countryCode: z.string().min(2), address: z.string().nullish(), residentCountry: z.string().nullish(),
  }).parse(req.body);
  ok(res, await cardInfra.onboardCustomer(body), 201);
}));

/** @swagger
 * /api/admin/cards/profiles:
 *   get:
 *     summary: List partner profiles
 *     tags: [admin-cards]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/profiles', asyncHandler(async (_req, res) => ok(res, await cardInfra.getProfiles())));

/** @swagger
 * /api/admin/cards/card-profiles:
 *   get:
 *     summary: List card profiles
 *     tags: [admin-cards]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/card-profiles', asyncHandler(async (_req, res) => ok(res, await cardInfra.getCardProfiles())));

/** @swagger
 * /api/admin/cards/requests:
 *   post:
 *     summary: Request new card(s)
 *     tags: [admin-cards]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/requests', asyncHandler(async (req, res) => {
  const body = z.object({
    profileId: uuid, cardProfileId: uuid,
    nameOnCards: z.array(z.string().min(1)).optional(),
    instantQty: z.number().int().positive().optional(),
  }).parse(req.body);
  ok(res, await cardInfra.requestCard(body), 201);
}));

/** @swagger
 * /api/admin/cards/associate:
 *   post:
 *     summary: Associate a card with a customer
 *     tags: [admin-cards]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/associate', asyncHandler(async (req, res) => {
  const b = z.object({ customerId: uuid, cardId: uuid }).parse(req.body);
  ok(res, await cardInfra.associateCard(b.customerId, b.cardId));
}));

/** @swagger
 * /api/admin/cards:
 *   get:
 *     summary: List cards (filter by customerId, maskedPan, nameOnCard)
 *     tags: [admin-cards]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/', asyncHandler(async (req, res) => {
  const q = z.object({ customerId: z.string().optional(), maskedPan: z.string().optional(), nameOnCard: z.string().optional() }).parse(req.query);
  ok(res, await cardInfra.listCards(q));
}));

/** @swagger
 * /api/admin/cards/{cardId}/load:
 *   post:
 *     summary: Load funds onto a card
 *     tags: [admin-cards]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/:cardId/load', asyncHandler(async (req, res) => {
  const cardId = uuid.parse(req.params.cardId);
  ok(res, await cardInfra.loadCard(cardId, amount.parse(req.body?.amount)));
}));

/** @swagger
 * /api/admin/cards/{cardId}/unload:
 *   post:
 *     summary: Unload funds from a card
 *     tags: [admin-cards]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/:cardId/unload', asyncHandler(async (req, res) => {
  const cardId = uuid.parse(req.params.cardId);
  ok(res, await cardInfra.unloadCard(cardId, amount.parse(req.body?.amount)));
}));

/** @swagger
 * /api/admin/cards/{cardId}/block:
 *   post:
 *     summary: Block a card
 *     tags: [admin-cards]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/:cardId/block', asyncHandler(async (req, res) => ok(res, await cardInfra.blockCard(uuid.parse(req.params.cardId)))));

/** @swagger
 * /api/admin/cards/{cardId}/unblock:
 *   post:
 *     summary: Unblock a card
 *     tags: [admin-cards]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/:cardId/unblock', asyncHandler(async (req, res) => ok(res, await cardInfra.unblockCard(uuid.parse(req.params.cardId)))));

/** @swagger
 * /api/admin/cards/{cardId}/pin:
 *   post:
 *     summary: Set card PIN (4 digits; never logged)
 *     tags: [admin-cards]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/:cardId/pin', asyncHandler(async (req, res) => {
  const pin = z.string().regex(/^\d{4}$/, 'PIN must be 4 digits').parse(req.body?.pin);
  ok(res, await cardInfra.setPin(uuid.parse(req.params.cardId), pin));
}));

/** @swagger
 * /api/admin/cards/transactions/card:
 *   get:
 *     summary: Card transactions (cardId, fromDate, toDate, page, pageSize)
 *     tags: [admin-cards]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/transactions/card', asyncHandler(async (req, res) => ok(res, await cardInfra.getCardTransactions(txnQuery.parse(req.query)))));

/** @swagger
 * /api/admin/cards/transactions/funding:
 *   get:
 *     summary: Funding transactions (cardId, fromDate, toDate, page, pageSize)
 *     tags: [admin-cards]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/transactions/funding', asyncHandler(async (req, res) => ok(res, await cardInfra.getFundingTransactions(txnQuery.parse(req.query)))));

// Map zod validation failures to 400 instead of a generic 500
router.use((err: any, _req: Request, res: Response, next: NextFunction): void => {
  if (err instanceof z.ZodError) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: err.issues } });
    return;
  }
  next(err);
});

export default router;
