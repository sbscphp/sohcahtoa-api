import { Kafka, Producer, Consumer } from 'kafkajs';
import { createLogger } from '@fx-platform/shared-utils';
import { DomainEvent, EventType, ServiceName } from '@fx-platform/shared-types';

const logger = createLogger(ServiceName.TRANSACTION);

const kafka = new Kafka({
  clientId: 'transaction-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});

let producer: Producer;
let consumer: Consumer;

export const initKafka = async () => {
  producer = kafka.producer();
  await producer.connect();
  logger.info('Kafka producer connected');

  consumer = kafka.consumer({ groupId: 'transaction-service-group' });
  await consumer.connect();
  logger.info('Kafka consumer connected');
};

export const publishEvent = async (event: DomainEvent): Promise<void> => {
  await producer.send({
    topic: event.eventType,
    messages: [
      {
        key: event.eventId,
        value: JSON.stringify(event),
      },
    ],
  });
  logger.info(`Event published: ${event.eventType}`);
};

export const disconnectKafka = async () => {
  await producer.disconnect();
  await consumer.disconnect();
};
