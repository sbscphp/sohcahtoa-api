import { Request, Response, NextFunction } from 'express';
import { presigningEnabled, signUrlsDeep } from '../utils/storage';
import { createLogger } from '../utils/logger';

const logger = createLogger('sign-file-urls');

/**
 * Files live in a private S3 bucket and the DB stores permanent object URLs.
 * This wraps res.json so any bucket URL in an outgoing response is swapped for a
 * short-lived presigned URL — no per-endpoint changes needed.
 */
export function signFileUrls(_req: Request, res: Response, next: NextFunction): void {
  if (!presigningEnabled() || !process.env.AWS_BUCKET_NAME) return next();

  const original = res.json.bind(res);
  res.json = ((body?: any) => {
    signUrlsDeep(body)
      .then((signed) => original(signed))
      .catch((error) => {
        logger.error('URL signing failed, sending response unsigned', { message: error?.message });
        original(body);
      });
    return res;
  }) as Response['json'];

  next();
}
