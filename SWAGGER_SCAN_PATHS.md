# Swagger Documentation Scan Paths

This document lists all the paths that Swagger scans to generate API documentation.

## 📂 Scanned File Patterns

The Swagger configuration scans the following TypeScript files for JSDoc comments:

### 1. **Module Routes** (Primary Documentation Source)
```
src/modules/*/routes/*.ts
src/modules/*/*/routes/*.ts
```

**Files Found:**
- `src/modules/admin/routes/admin-auth.routes.ts`
- `src/modules/admin/routes/admin.routes.ts`
- `src/modules/admin/routes/agent.routes.ts`
- `src/modules/admin/routes/audit.routes.ts`
- `src/modules/admin/routes/customer.routes.ts`
- `src/modules/admin/routes/outlet.routes.ts`
- `src/modules/admin/routes/rate.routes.ts`
- `src/modules/admin/routes/report.routes.ts`
- `src/modules/admin/routes/tickets.routes.ts`
- `src/modules/admin/routes/transaction.routes.ts`
- `src/modules/admin/routes/user-management.routes.ts`
- `src/modules/admin/routes/workflow.routes.ts`
- `src/modules/auth/routes/auth.routes.ts` ← **Contains Expatriate endpoints**
- `src/modules/customer/routes/customer-transaction.routes.ts`
- `src/modules/payments/routes/payment.routes.ts`
- `src/modules/transactions/routes/transaction.routes.ts`

### 2. **Module Controllers**
```
src/modules/*/controllers/*.ts
src/modules/*/*/controllers/*.ts
```

These files may contain JSDoc comments for additional documentation.

### 3. **Module Services**
```
src/modules/*/services/*.ts
```

Service files are scanned in case they contain JSDoc comments.

### 4. **Root Level Routes**
```
src/routes/*.ts
```

Any routes defined at the root level.

### 5. **Main Application Files**
```
src/app.ts
src/index.ts
```

Main entry points that may contain route definitions.

### 6. **Shared Middleware**
```
src/shared/middleware/*.ts
```

Middleware files that might document authentication, validation, etc.

---

## 🔍 How It Works

1. **Swagger-JSDoc** scans all TypeScript files matching these patterns
2. It looks for **JSDoc comments** with `@swagger` or `@openapi` tags
3. Comments are parsed and converted to OpenAPI 3.0 specification
4. The spec is served at `/api-docs.json` and rendered at `/api-docs/`

---

## ⚠️ Important Notes

### Why TypeScript Files Instead of JavaScript?

**TypeScript compilation strips JSDoc comments** from compiled `.js` files. Therefore, we must scan the original `.ts` source files where the comments are preserved.

The `swagger-jsdoc` library can parse TypeScript files directly without needing them to be compiled first.

### Example JSDoc Comment Format

```typescript
/**
 * @swagger
 * /api/auth/signup/expatriate/verify-passport:
 *   post:
 *     summary: Step 1 - Verify expatriate passport for signup
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               passportDocumentUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Passport verified successfully
 */
router.post('/signup/expatriate/verify-passport', authController.verifyExpatriatePassport);
```

---

## 🚀 Rebuilding Documentation

After making changes to JSDoc comments:

1. **Development:** The swagger spec is regenerated on server restart
2. **Production:** Rebuild and redeploy the application

```bash
# Development
npm run dev

# Production
npm run build
npm start

# Docker
docker-compose build
docker-compose up -d
```

---

## 📊 Expected Output

When the server starts, you should see in the logs:

```
🔍 Swagger scanning paths: [ ... array of paths ... ]
📁 Current directory: /path/to/dist/shared/utils
📁 Root directory: /path/to/project
🏭 Is production: false
📚 Swagger generated XXX API endpoints
📚 Swagger UI available at http://localhost:3000/api-docs
```

If `XXX` is 0, the warning system will list files found for each pattern to help debug.

---

## 🎯 Current Documented Endpoints

Your Swagger documentation includes:

### Authentication (`/api/auth`)
- ✅ Nigerian signup flow (4 steps)
- ✅ Tourist signup flow (4 steps)
- ✅ **Expatriate signup flow (4 steps)** ← NEW
- ✅ Login, OTP, tokens
- ✅ KYC endpoints

### Admin (`/api/admin`)
- ✅ Dashboard & statistics
- ✅ Customer management
- ✅ Transaction management
- ✅ Franchise & branch (outlet) management
- ✅ User & role management
- ✅ Workflow & audit

### Customer (`/api/customer`)
- ✅ Customer transactions
- ✅ Rate calculations

### Transactions (`/api/transactions`)
- ✅ Transaction operations

### Payments (`/api/payments`)
- ✅ Payment processing

---

## 🔧 Troubleshooting

### No Endpoints Showing Up?

1. **Check JSDoc format:** Ensure `@swagger` tag is present
2. **Check file paths:** Verify files match one of the scan patterns above
3. **Restart server:** Swagger spec is generated at startup
4. **Check logs:** Look for the "📚 Swagger generated X endpoints" message
5. **Clear browser cache:** Hard refresh (Ctrl+Shift+R)

### Endpoints Missing After Deploy?

Make sure the **source TypeScript files** are included in your Docker image or deployment package, not just the compiled JavaScript files.

---

## 📚 Access Points

- **Swagger UI:** http://localhost:3000/api-docs/
- **OpenAPI JSON:** http://localhost:3000/api-docs.json
- **Production:** https://sohcahtoa-dev.clocksurewise.com/api-docs/
