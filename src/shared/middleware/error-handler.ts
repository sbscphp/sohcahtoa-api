import { Request, Response, NextFunction } from 'express';
import { AppError, errorResponse } from '@fx-platform/shared-utils';
import { ErrorCode } from '@fx-platform/shared-types';
import { Logger } from '@fx-platform/shared-utils';

export const errorHandler = (logger: Logger) => {
  return (err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof AppError) {
      logger.error(`${err.code}: ${err.message}`, {
        statusCode: err.statusCode,
        details: err.details,
        stack: err.stack,
      });

      return res.status(err.statusCode).json(
        errorResponse(err.code, err.message, err.details)
      );
    }

    // Handle Prisma errors
    if (err.name === 'PrismaClientKnownRequestError') {
      logger.error('Prisma error:', err);
      return res.status(400).json(
        errorResponse(ErrorCode.VALIDATION_ERROR, 'Database operation failed')
      );
    }

    // Handle validation errors
    if (err.name === 'ValidationError') {
      logger.error('Validation error:', err);
      return res.status(400).json(
        errorResponse(ErrorCode.VALIDATION_ERROR, err.message)
      );
    }

    // Default error
    logger.error('Unhandled error:', err);
    return res.status(500).json(
      errorResponse(
        ErrorCode.INTERNAL_ERROR,
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : err.message
      )
    );
  };
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
