import { Request, Response, NextFunction } from 'express';

export const requestLogger = (logger: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const logData: Record<string, any> = {
        method: req.method,
        path: req.path,
        url: req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
        contentLength: res.get('content-length'),
      };

      // Add query params if present
      if (Object.keys(req.query).length > 0) {
        logData['query'] = req.query;
      }

      // Add request body summary for POST/PUT/PATCH (but don't log sensitive data)
      if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
        const bodyKeys = Object.keys(req.body);
        if (bodyKeys.length > 0) {
          logData['bodyFields'] = bodyKeys;
        }
      }

      if (res.statusCode >= 400) {
        logger.error('Request failed', logData);
      } else {
        logger.http('Request completed', logData);
      }
    });

    next();
  };
};
