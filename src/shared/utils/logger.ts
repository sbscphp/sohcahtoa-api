import winston from 'winston';
import { ServiceName } from '../types';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

const safeStringify = (obj: unknown): string => {
  const seen = new WeakSet();
  return JSON.stringify(obj, (_key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }
    return value;
  });
};

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, service, ...metadata } = info;
    let log = `${timestamp} ${level}: ${message}`;

    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      log += ` ${safeStringify(metadata)}`;
    }

    return log;
  })
);

export const createLogger = (serviceName: ServiceName | string) => {
  const transports = [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: `logs/${serviceName}-error.log`,
      level: 'error',
    }),
    new winston.transports.File({
      filename: `logs/${serviceName}-all.log`,
    }),
  ];

  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'debug',
    levels,
    format,
    transports,
    defaultMeta: { service: serviceName },
  });
};

export type Logger = winston.Logger;
