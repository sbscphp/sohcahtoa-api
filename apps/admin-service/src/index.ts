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

import { createLogger } from "@fx-platform/shared-utils";
import { ServiceName, UserRole } from "@fx-platform/shared-types";

import { initKafka, disconnectKafka } from "./config/kafka";
import prisma from "./config/database";
import adminRoutes from "./routes/admin.routes";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3007;
const logger = createLogger(ServiceName.ADMIN);

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(correlationIdMiddleware);
app.use(requestLogger(logger));

// All routes require admin authentication
app.use(authenticate);
app.use(authorize(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER, UserRole.OPERATIONS, UserRole.SUPER_ADMIN));

// Routes
app.use("/api/admin", adminRoutes);

app.use(errorHandler(logger));

const server = app.listen(PORT, async () => {
  await initKafka();
  logger.info(`Admin Service running on port ${PORT}`);
});

process.on("SIGTERM", async () => {
  server.close();
  await disconnectKafka();
  await prisma.$disconnect();
  process.exit(0);
});

export default app;
