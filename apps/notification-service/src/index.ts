import express from 'express';
import dotenv from 'dotenv';
import { Kafka } from 'kafkajs';
import { createLogger, setupSwagger } from '@fx-platform/shared-utils';
import { EventType, ServiceName } from '@fx-platform/shared-types';
import nodemailer from 'nodemailer';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3006;
const logger = createLogger(ServiceName.NOTIFICATION);

app.use(express.json());

// Swagger Documentation
setupSwagger(app, {
  title: 'Notification Service API',
  description: 'FX Platform Notification Service - Email and SMS notification delivery (Event-driven)',
  version: '1.0.0',
  serviceName: 'notification-service',
  port: Number(PORT),
  apiBasePath: '',
});

// Email transporter
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

// Kafka consumer
const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});

const consumer = kafka.consumer({ groupId: 'notification-service-group' });

async function sendEmail(to: string, subject: string, body: string) {
  try {
    await emailTransporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@fxplatform.com',
      to,
      subject,
      html: body,
    });
    logger.info(`Email sent to ${to}`);
  } catch (error) {
    logger.error('Email send failed:', error);
  }
}

async function sendSMS(to: string, message: string) {
  try {
    // Integration with Termii or other SMS provider
    await axios.post('https://api.termii.com/api/sms/send', {
      to,
      from: process.env.TERMII_SENDER_ID,
      sms: message,
      type: 'plain',
      api_key: process.env.TERMII_API_KEY,
      channel: 'generic',
    });
    logger.info(`SMS sent to ${to}`);
  } catch (error) {
    logger.error('SMS send failed:', error);
  }
}

async function handleEvent(event: any) {
  logger.info(`Processing event: ${event.eventType}`);

  switch (event.eventType) {
    case EventType.USER_REGISTERED:
      await sendEmail(
        event.data.email,
        'Welcome to FX Platform',
        `<h1>Welcome ${event.data.firstName}!</h1><p>Your account has been created successfully.</p>`
      );
      break;

    case EventType.TRANSACTION_CREATED:
      await sendEmail(
        event.data.userEmail || 'user@example.com',
        'Transaction Created',
        `<p>Your transaction has been created successfully. Reference: ${event.data.transactionId}</p>`
      );
      break;

    case EventType.DEPOSIT_CONFIRMED:
      await sendEmail(
        event.data.userEmail || 'user@example.com',
        'Deposit Confirmed',
        `<p>Your deposit of ${event.data.amount} ${event.data.currency} has been confirmed.</p>`
      );
      break;

    default:
      logger.info(`No handler for event type: ${event.eventType}`);
  }
}

async function startConsumer() {
  await consumer.connect();
  await consumer.subscribe({
    topics: [
      EventType.USER_REGISTERED,
      EventType.TRANSACTION_CREATED,
      EventType.DEPOSIT_CONFIRMED,
      EventType.AML_FLAG_RAISED,
    ],
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const event = JSON.parse(message.value?.toString() || '{}');
      await handleEvent(event);
    },
  });
}

/**
 * @swagger
 * tags:
 *   name: Notification
 *   description: Notification service health check
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Notification]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 service:
 *                   type: string
 *                   example: notification-service
 */
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'notification-service' });
});

app.listen(PORT, async () => {
  await startConsumer();
  logger.info(`Notification Service running on port ${PORT}`);
});
