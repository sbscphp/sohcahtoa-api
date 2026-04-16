import { Router } from "express";
import { authenticate, requirePermission } from "../../../shared/middleware";
import { rateController } from "../controllers/rate.controller";

const RateRouter: Router = Router();

/**
 * @swagger
 * /api/admin/rate/stats:
 *   get:
 *     summary: Get exchange rate statistics
 *     tags: [admin-rate]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
RateRouter.get(
  "/stats",
  authenticate,
  requirePermission({ module: "RATE", feature: "MODULE", action: "view" }),
  rateController.stats
);

/**
 * @swagger
 * /api/admin/rate/export:
 *   get:
 *     summary: Export exchange rates as CSV
 *     tags: [admin-rate]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Export URL generated
 */
RateRouter.get(
  "/export",
  authenticate,
  requirePermission({ module: "RATE", feature: "MODULE", action: "export" }),
  rateController.export
);

/**
 * @swagger
 * /api/admin/rate:
 *   get:
 *     summary: List exchange rates
 *     tags: [admin-rate]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search query for currency codes
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, active, scheduled, expired, deactivated]
 *         description: Filter by rate status (default is all)
 *       - in: query
 *         name: fromCurrency
 *         schema:
 *           type: string
 *         description: Filter by source currency (e.g., USD, EUR, GBP)
 *         example: USD
 *       - in: query
 *         name: toCurrency
 *         schema:
 *           type: string
 *         description: Filter by target currency (e.g., NGN)
 *         example: NGN
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Rates retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       fromCurrency:
 *                         type: string
 *                         example: USD
 *                       toCurrency:
 *                         type: string
 *                         example: NGN
 *                       buyRate:
 *                         type: number
 *                         example: 1450.50
 *                       sellRate:
 *                         type: number
 *                         example: 1465.75
 *                       validFrom:
 *                         type: string
 *                         format: date-time
 *                       validUntil:
 *                         type: string
 *                         format: date-time
 *                 meta:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 */
RateRouter.get(
  "/",
  authenticate,
  requirePermission({ module: "RATE", feature: "MODULE", action: "view" }),
  rateController.list
);

/**
 * @swagger
 * /api/admin/rate/{id}:
 *   get:
 *     summary: Get specific exchange rate
 *     tags: [admin-rate]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Rate retrieved successfully
 */
RateRouter.get(
  "/:id",
  authenticate,
  requirePermission({ module: "RATE", feature: "MODULE", action: "view" }),
  rateController.get
);

/**
 * @swagger
 * /api/admin/rate:
 *   post:
 *     summary: Create new exchange rate
 *     tags: [admin-rate]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fromCurrency, toCurrency, buyRate, sellRate, validFrom, validUntil]
 *             properties:
 *               fromCurrency:
 *                 type: string
 *               toCurrency:
 *                 type: string
 *               buyRate:
 *                 type: number
 *               sellRate:
 *                 type: number
 *               note:
 *                 type: string
 *               validFrom:
 *                 type: string
 *                 format: date-time
 *               validUntil:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Rate created successfully
 */
RateRouter.post(
  "/",
  authenticate,
  requirePermission({ module: "RATE", feature: "MODULE", action: "create" }),
  rateController.create
);

/**
 * @swagger
 * /api/admin/rate/{id}:
 *   put:
 *     summary: Update exchange rate
 *     tags: [admin-rate]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               buyRate:
 *                 type: number
 *               sellRate:
 *                 type: number
 *               validFrom:
 *                 type: string
 *                 format: date-time
 *               validUntil:
 *                 type: string
 *                 format: date-time
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Rate updated successfully
 */
RateRouter.put(
  "/:id",
  authenticate,
  requirePermission({ module: "RATE", feature: "MODULE", action: "edit" }),
  rateController.update
);

/**
 * @swagger
 * /api/admin/rate/{id}/deactivate:
 *   patch:
 *     summary: Deactivate exchange rate
 *     tags: [admin-rate]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Rate deactivated successfully
 */
RateRouter.patch(
  "/:id/deactivate",
  authenticate,
  requirePermission({ module: "RATE", feature: "MODULE", action: "edit" }),
  rateController.deactivate
);

export default RateRouter;
