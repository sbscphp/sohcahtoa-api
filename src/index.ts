import 'dotenv/config';
import { createApp } from './app';
import { initializeDatabase, disconnectDatabase } from './config/database';
import { initializeRedis, disconnectRedis } from './config/redis';
import { initializeEmail } from './config/email';
import { createLogger } from './shared/utils/logger';
import { eventBus } from './events/event-bus';

const logger = createLogger('Server');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Initialize the application
async function startServer() {
  try {
    logger.info('Starting Sochatoa API Monolith...');

    // Initialize database
    logger.info('Initializing database connection...');
    initializeDatabase();

    // Initialize Redis
    logger.info('Initializing Redis connection...');
    initializeRedis();

    // Initialize Email service
    logger.info('Initializing email service...');
    initializeEmail();

    // Initialize event bus handlers
    initializeEventHandlers();

    // Create Express app
    const app = await createApp();

    // Start HTTP server
    const server = app.listen(PORT, HOST, () => {
      logger.info(`Server is running on http://${HOST}:${PORT}`);
      logger.info(`API Documentation available at http://${HOST}:${PORT}/api-docs`);
      logger.info(`Health check available at http://${HOST}:${PORT}/health`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await disconnectDatabase();
          await disconnectRedis();
          logger.info('All connections closed successfully');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Initialize event handlers for cross-module communication
 */
function initializeEventHandlers() {
  logger.info('Initializing event handlers...');

  // Subscribe to all events for auditing (optional)
  eventBus.subscribeToAll((event) => {
    logger.debug('Event emitted:', {
      type: event.eventType,
      timestamp: event.timestamp,
    });
  });

  // Initialize module-specific event handlers
  try {
    // Notification service handlers
    initializeNotificationHandlers();
  } catch (error) {
    logger.warn('Failed to initialize notification handlers:', error);
  }

  try {
    // Audit service handlers
    initializeAuditHandlers();
  } catch (error) {
    logger.warn('Failed to initialize audit handlers:', error);
  }

  try {
    // Compliance service handlers
    initializeComplianceHandlers();
  } catch (error) {
    logger.warn('Failed to initialize compliance handlers:', error);
  }

  logger.info('Event handlers initialized');
}

/**
 * Initialize notification event handlers
 */
function initializeNotificationHandlers() {
  const { EventTypes } = require('./events/event-bus');
  const { sendEmail } = require('./config/email');

  // Send welcome email on user registration
  eventBus.subscribe(EventTypes.USER_REGISTERED, async (payload) => {
    try {
      await sendEmail({
        to: payload.email,
        subject: 'Welcome to Sochatoa API',
        html: `<h1>Welcome ${payload.firstName || 'User'}!</h1><p>Your account has been created successfully.</p>`,
      });
      logger.info('Welcome email sent to:', payload.email);
    } catch (error) {
      logger.error('Failed to send welcome email:', error);
    }
  });

  // Send transaction notifications
  eventBus.subscribe(EventTypes.TRANSACTION_CREATED, async (payload) => {
    try {
      if (payload.userEmail) {
        await sendEmail({
          to: payload.userEmail,
          subject: 'Transaction Created',
          html: `<h1>Transaction Created</h1><p>Your transaction ${payload.referenceNumber} has been created.</p>`,
        });
      }
    } catch (error) {
      logger.error('Failed to send transaction email:', error);
    }
  });

  logger.info('Notification handlers registered');
}

/**
 * Initialize audit event handlers
 */
function initializeAuditHandlers() {
  const { initializeAuditListeners } = require('./modules/audit/listeners/audit.listeners');
  initializeAuditListeners();
}

/**
 * Initialize compliance event handlers
 */
function initializeComplianceHandlers() {
  const { EventTypes } = require('./events/event-bus');

  // Trigger AML check on transaction submission
  eventBus.subscribe(EventTypes.TRANSACTION_SUBMITTED, async (payload) => {
    try {
      logger.info('Triggering AML check for transaction:', payload.transactionId);
      // AML check logic would be triggered here
      // This is a placeholder - actual implementation would be in compliance service
    } catch (error) {
      logger.error('Failed to trigger AML check:', error);
    }
  });

  logger.info('Compliance handlers registered');
}

// Start the server
startServer();
