import { Kafka, Producer } from 'kafkajs';
import { createLogger, ServiceName } from '@fx-platform/shared-utils';
import { DomainEvent } from '@fx-platform/shared-types';

const logger = createLogger(ServiceName.ADMIN);

const kafka = new Kafka({
  clientId: 'admin-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});

let producer: Producer;

export const initKafka = async () => {
  producer = kafka.producer();
  await producer.connect();
  logger.info('Kafka producer connected');
};

export const publishEvent = async (event: DomainEvent): Promise<void> => {
  await producer.send({
    topic: event.eventType,
    messages: [{ key: event.eventId, value: JSON.stringify(event) }],
  });
  logger.info(`Event published: ${event.eventType}`);
};

export const disconnectKafka = async () => {
  await producer.disconnect();
};
