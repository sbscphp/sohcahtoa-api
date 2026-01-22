import { Kafka, Producer, Consumer } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'payment-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});

let producer: Producer;
let consumer: Consumer;

export async function initKafka() {
  producer = kafka.producer();
  consumer = kafka.consumer({ groupId: 'payment-service-group' });
  await producer.connect();
  await consumer.connect();
}

export async function disconnectKafka() {
  if (producer) await producer.disconnect();
  if (consumer) await consumer.disconnect();
}

export async function publishEvent(event: any) {
  if (!producer) throw new Error('Kafka producer not initialized');
  await producer.send({
    topic: 'events',
    messages: [{ value: JSON.stringify(event) }],
  });
}

export async function subscribeToEvents(eventTypes: string[], handler: (event: any) => Promise<void>) {
  if (!consumer) throw new Error('Kafka consumer not initialized');
  await consumer.subscribe({ topic: 'events', fromBeginning: true });
  await consumer.run({
    eachMessage: async ({ message }) => {
      const event = JSON.parse(message.value?.toString() || '{}');
      if (eventTypes.includes(event.eventType)) {
        await handler(event);
      }
    },
  });
}
