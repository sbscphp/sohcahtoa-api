import { Request, Response, NextFunction } from 'express';

export const requestLogger = (logger: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const logData = {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      };

      if (res.statusCode >= 400) {
        logger.error('Request failed', logData);
      } else {
        logger.http('Request completed', logData);
      }
    });

    next();
  };
};

export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const correlationId = req.headers['x-correlation-id'] as string ||
                        req.headers['x-request-id'] as string ||
                        `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('x-correlation-id', correlationId);

  next();
};
