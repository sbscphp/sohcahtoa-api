import { Kafka, Producer, Consumer } from 'kafkajs';
import { createLogger } from '@fx-platform/shared-utils';
import { ServiceName } from '@fx-platform/shared-types';;
import { DomainEvent, EventType } from '@fx-platform/shared-types';

const logger = createLogger(ServiceName.DOCUMENT);

const kafka = new Kafka({
  clientId: 'document-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});

let producer: Producer;
let consumer: Consumer;

export const initKafka = async () => {
  producer = kafka.producer();
  await producer.connect();
  logger.info('Kafka producer connected');

  consumer = kafka.consumer({ groupId: 'document-service-group' });
  await consumer.connect();
  logger.info('Kafka consumer connected');
};

export const publishEvent = async (event: DomainEvent): Promise<void> => {
  await producer.send({
    topic: event.eventType,
    messages: [{ key: event.eventId, value: JSON.stringify(event) }],
  });
  logger.info(`Event published: ${event.eventType}`);
};

export const subscribeToEvents = async (topics: EventType[], handler: (event: DomainEvent) => Promise<void>) => {
  await consumer.subscribe({ topics, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const event = JSON.parse(message.value?.toString() || '{}') as DomainEvent;
      logger.info(`Event received: ${topic}`);
      await handler(event);
    },
  });
};

export const disconnectKafka = async () => {
  await producer.disconnect();
  await consumer.disconnect();
};
