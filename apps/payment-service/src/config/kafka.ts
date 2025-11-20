import { Kafka } from 'kafkajs';
import { DomainEvent } from '@fx-platform/shared-types';

const kafka = new Kafka({
  clientId: 'payment-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});

let producer = kafka.producer();

export const initKafka = async () => {
  await producer.connect();
};

export const publishEvent = async (event: DomainEvent) => {
  await producer.send({
    topic: event.eventType,
    messages: [{ key: event.eventId, value: JSON.stringify(event) }],
  });
};

export const disconnectKafka = async () => {
  await producer.disconnect();
};
