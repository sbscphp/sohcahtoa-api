import multer from 'multer';
import { Request } from 'express';
import { ValidationError } from '../utils';
import { UPLOAD_LIMITS, formatFileSize } from '../config/upload-limits';

// Configure multer to use memory storage
const storage = multer.memoryStorage();

// File filter for images and PDFs
const imageFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/pjpeg',
    'image/x-citrix-jpeg',
    'image/x-jpeg',
    'image/png',
    'image/x-png',
    'image/webp',
    'application/pdf',
  ];

  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
  const ext = ('.' + (file.originalname.split('.').pop() || '')).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new ValidationError(`Invalid file type. Allowed types: JPEG, PNG, WEBP, PDF`));
  }
};

// File filter for documents (broader set)
const documentFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/pjpeg',
    'image/x-citrix-jpeg',
    'image/x-jpeg',
    'image/png',
    'image/x-png',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  // Also accept by extension when mimetype is generic (e.g. application/octet-stream)
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.doc', '.docx'];
  const ext = ('.' + (file.originalname.split('.').pop() || '')).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new ValidationError(`Invalid file type. Allowed types: JPEG, PNG, WEBP, PDF, DOC, DOCX`));
  }
};

/**
 * Upload middleware for single image/PDF files (passports, IDs, etc.)
 * Max size: 5MB
 */
export const uploadSingleImage = multer({
  storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: UPLOAD_LIMITS.MEDIUM_FILE,
  },
}).single('file');

/**
 * Upload middleware for passport documents
 * Max size: 5MB
 */
export const uploadPassport = multer({
  storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: UPLOAD_LIMITS.PASSPORT_IMAGE,
  },
}).single('passport');

/**
 * Upload middleware for multiple documents
 * Max files: 10
 * Max size per file: 5MB
 */
const _uploadMultipleDocuments = multer({
  storage,
  fileFilter: documentFilter,
  limits: {
    fileSize: UPLOAD_LIMITS.TRANSACTION_DOCUMENT,
    files: UPLOAD_LIMITS.MAX_FILES_PER_UPLOAD,
  },
}).array('documents', UPLOAD_LIMITS.MAX_FILES_PER_UPLOAD);

export const uploadMultipleDocuments = (req: any, res: any, next: any) => {
  _uploadMultipleDocuments(req, res, (err: any) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new ValidationError(`File too large. Max size is ${formatFileSize(UPLOAD_LIMITS.TRANSACTION_DOCUMENT)}`));
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return next(new ValidationError(`Too many files. Maximum ${UPLOAD_LIMITS.MAX_FILES_PER_UPLOAD} files allowed per upload`));
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(new ValidationError(`Unexpected file field. Use the field name 'documents'`));
      }
      return next(new ValidationError(err.message));
    }
    return next(err);
  });
};

/**
 * Upload middleware for single document
 * Max size: 10MB
 */
export const uploadSingleDocument = multer({
  storage,
  fileFilter: documentFilter,
  limits: {
    fileSize: UPLOAD_LIMITS.LARGE_FILE,
  },
}).single('document');

/**
 * Generic upload middleware with custom options
 */
export const createUploadMiddleware = (options: {
  fieldName: string;
  maxSize?: number;
  allowedMimeTypes?: string[];
  multiple?: boolean;
  maxFiles?: number;
}) => {
  const {
    fieldName,
    maxSize = UPLOAD_LIMITS.MEDIUM_FILE,
    allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
    multiple = false,
    maxFiles = UPLOAD_LIMITS.MAX_FILES_PER_UPLOAD,
  } = options;

  const customFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ValidationError(`Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`));
    }
  };

  const upload = multer({
    storage,
    fileFilter: customFilter,
    limits: {
      fileSize: maxSize,
      files: multiple ? maxFiles : 1,
    },
  });

  const handler = multiple ? upload.array(fieldName, maxFiles) : upload.single(fieldName);
  return (req: any, res: any, next: any) => {
    handler(req, res, (err: any) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new ValidationError(`File too large. Max size is ${formatFileSize(maxSize)}`));
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return next(new ValidationError(`Too many files. Max files is ${maxFiles}`));
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(new ValidationError(`Unexpected file field. Expected '${fieldName}'`));
        }
        return next(new ValidationError(err.message));
      }
      return next(err);
    });
  };
};

/**
 * Upload middleware for proof of payment
 * Max size: 5MB
 */
export const uploadProofOfPayment = multer({
  storage,
  fileFilter: imageFilter,
  limits: {
  fileSize: UPLOAD_LIMITS.PROOF_OF_PAYMENT,
  },
}).single('proofOfPayment');

export const uploadAgentDisbursementReceipt = createUploadMiddleware({
  fieldName: 'paymentReceipt',
  maxSize: UPLOAD_LIMITS.PROOF_OF_PAYMENT,
  allowedMimeTypes: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf',
  ],
  multiple: false,
});

export default {
  uploadSingleImage,
  uploadPassport,
  uploadMultipleDocuments,
  uploadSingleDocument,
  uploadProofOfPayment,
  uploadAgentDisbursementReceipt,
  createUploadMiddleware,
};
