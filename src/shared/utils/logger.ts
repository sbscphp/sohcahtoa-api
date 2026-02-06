import winston from 'winston';
import { ServiceName } from '@fx-platform/shared-types';

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

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
);

export const createLogger = (serviceName: ServiceName) => {
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
