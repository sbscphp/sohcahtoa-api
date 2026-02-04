import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";

import {
  errorHandler,
  requestLogger,
  correlationIdMiddleware,
  authenticate,
  authorize,
} from "@fx-platform/shared-middlewares";

import { createLogger, setupScalar } from "@fx-platform/shared-utils";
import { ServiceName, UserRole } from "@fx-platform/shared-types";

import { initKafka, disconnectKafka } from "./config/kafka";
import prisma from "./config/database";
import adminRoutes from "./routes/admin.routes";
import userRoutes from "./routes/user-management.routes";
import { initializeEmailService } from "./config/email";
import customerRoutes from "./routes/customer.routes";

dotenv.config();

const app: Express = express();
app.use((req, res, next) => {
  console.log(`[DEBUG] Incoming Request: ${req.method} ${req.url}`);
  next();
});
const PORT = process.env.PORT || 3007;
const logger = createLogger(ServiceName.ADMIN);

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(correlationIdMiddleware);
app.use(requestLogger(logger));

app.use("/api/user", userRoutes);
app.use(authenticate);
app.use(authorize(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER, UserRole.OPERATIONS, UserRole.SUPER_ADMIN));

// Routes
app.use("/api/admin", adminRoutes);
app.use("/api/admin/customers", customerRoutes);

app.use(errorHandler(logger));

let server: any;

const startServer = async () => {
  try {
    // API Documentation with Scalar
    await setupScalar(app, {
      title: 'Admin Service API',
      description: 'FX Platform Admin Service - Admin operations for transaction management, customer management, and system oversight',
      version: '1.0.0',
      serviceName: 'admin-service',
      port: Number(PORT),
      apiBasePath: '/api/admin',
    });

    server = app.listen(PORT, async () => {
      initializeEmailService();
      await initKafka();
      logger.info(`Admin Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to initialize server:', error);
    process.exit(1);
  }
};

startServer();

process.on("SIGTERM", async () => {
  server.close();
  await disconnectKafka();
  await prisma.$disconnect();
  process.exit(0);
});

export default app;
