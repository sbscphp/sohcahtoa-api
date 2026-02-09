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
