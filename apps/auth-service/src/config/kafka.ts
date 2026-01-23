import { Kafka, Producer, Consumer } from 'kafkajs';
import { createLogger } from '@fx-platform/shared-utils';
import { ServiceName } from '@fx-platform/shared-types';;
import { DomainEvent, EventType } from '@fx-platform/shared-types';

const logger = createLogger(ServiceName.AUTH);

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'auth-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});

let producer: Producer;
let consumer: Consumer;

export const initKafka = async () => {
  try {
    producer = kafka.producer();
    await producer.connect();
    logger.info('Kafka producer connected');

    consumer = kafka.consumer({
      groupId: process.env.KAFKA_GROUP_ID || 'auth-service-group',
    });
    await consumer.connect();
    logger.info('Kafka consumer connected');
  } catch (error) {
    logger.error('Failed to initialize Kafka:', error);
    throw error;
  }
};

export const publishEvent = async (event: DomainEvent): Promise<void> => {
  try {
    await producer.send({
      topic: event.eventType,
      messages: [
        {
          key: event.eventId,
          value: JSON.stringify(event),
          headers: {
            source: ServiceName.AUTH,
            timestamp: event.timestamp,
          },
        },
      ],
    });
    logger.info(`Event published: ${event.eventType}`, { eventId: event.eventId });
  } catch (error) {
    logger.error('Failed to publish event:', error);
    throw error;
  }
};

export const subscribeToEvents = async (topics: EventType[], handler: (event: DomainEvent) => Promise<void>) => {
  try {
    await consumer.subscribe({ topics, fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const event = JSON.parse(message.value?.toString() || '{}') as DomainEvent;
          logger.info(`Event received: ${topic}`, { eventId: event.eventId });
          await handler(event);
        } catch (error) {
          logger.error('Failed to process event:', error);
        }
      },
    });
  } catch (error) {
    logger.error('Failed to subscribe to events:', error);
    throw error;
  }
};

export const disconnectKafka = async () => {
  await producer.disconnect();
  await consumer.disconnect();
  logger.info('Kafka disconnected');
};
