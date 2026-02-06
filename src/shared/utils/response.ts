import { ApiResponse, PaginatedResponse, ErrorCode } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const successResponse = <T>(data: T, metadata?: any): ApiResponse<T> => {
  return {
    success: true,
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
      version: '1.0',
      ...metadata,
    },
  };
};

export const errorResponse = (
  code: ErrorCode,
  message: string,
  details?: any
): ApiResponse => {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    metadata: {
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
      version: '1.0',
    },
  };
};

export const paginatedResponse = <T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): PaginatedResponse<T> => {
  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    metadata: {
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
      version: '1.0',
    },
  };
};
