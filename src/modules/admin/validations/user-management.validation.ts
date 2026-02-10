import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

export const validate = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
        return next();
    }

    const extractedErrors: any[] = [];
    errors.array().map(err => extractedErrors.push({ [err.type === 'field' ? err.path : 'unknown']: err.msg }));

    return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: extractedErrors,
    });
};

export const addUserValidationStore = [
    body('email').isEmail().withMessage('Enter a valid email address'),
    body('fullName').notEmpty().withMessage('Full name is required'),
    body('phoneNumber').notEmpty().withMessage('Phone number is required'),
    body('altPhoneNumber').optional().isString().withMessage('Alternative phone number is required'),
    body('position').optional().isString().withMessage('Invalid position'),
    body('department').notEmpty().withMessage('Department is required'),
    body('branch').notEmpty().withMessage('Branch is required'),
    body('roleId').isUUID().withMessage('Invalid Role ID'),
];
