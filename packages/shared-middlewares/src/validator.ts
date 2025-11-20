import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '@fx-platform/shared-utils';

export const validateBody = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const details = error.details.map((detail: any) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return next(new ValidationError('Validation failed', details));
    }

    req.body = value;
    next();
  };
};

export const validateQuery = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.query, { abortEarly: false });

    if (error) {
      const details = error.details.map((detail: any) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return next(new ValidationError('Query validation failed', details));
    }

    req.query = value;
    next();
  };
};

export const validateParams = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.params, { abortEarly: false });

    if (error) {
      const details = error.details.map((detail: any) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return next(new ValidationError('Params validation failed', details));
    }

    req.params = value;
    next();
  };
};
