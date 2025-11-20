import { Kafka, Consumer } from 'kafkajs';
import { createLogger, ServiceName } from '@fx-platform/shared-utils';
import { DomainEvent, EventType } from '@fx-platform/shared-types';

const logger = createLogger(ServiceName.AUDIT);

const kafka = new Kafka({
  clientId: 'audit-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});

let consumer: Consumer;

export const initKafka = async () => {
  consumer = kafka.consumer({ groupId: 'audit-service-group' });
  await consumer.connect();
  logger.info('Kafka consumer connected');
};

export const subscribeToAllEvents = async (handler: (event: DomainEvent) => Promise<void>) => {
  // Subscribe to all event topics
  const topics = Object.values(EventType);

  await consumer.subscribe({ topics, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        const event = JSON.parse(message.value?.toString() || '{}') as DomainEvent;
        logger.info(`Event received for audit: ${topic}`);
        await handler(event);
      } catch (error) {
        logger.error('Failed to process event for audit:', error);
      }
    },
  });
};

export const disconnectKafka = async () => {
  await consumer.disconnect();
};
