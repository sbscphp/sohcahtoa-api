import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

const normalizeNgPhoneNumber = (value: unknown): string | null => {
    if (value == null) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    const cleaned = raw.replace(/[^\d+]/g, "");
    const digits = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
    if (!/^\d+$/.test(digits)) return null;
    if (digits.startsWith("234")) {
        const national = digits.slice(3);
        if (national.length !== 10) return null;
        return `+234${national}`;
    }
    return null;
};

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
    body('phoneNumber')
        .customSanitizer((value) => normalizeNgPhoneNumber(value) ?? value)
        .notEmpty()
        .withMessage('Phone number is required')
        .custom((value) => {
            const normalized = normalizeNgPhoneNumber(value);
            if (!normalized) throw new Error('Phone number must be in +234XXXXXXXXXX format');
            return true;
        }),
    body('altPhoneNumber')
        .optional({ values: 'falsy' })
        .customSanitizer((value) => normalizeNgPhoneNumber(value) ?? value)
        .custom((value) => {
            const normalized = normalizeNgPhoneNumber(value);
            if (!normalized) throw new Error('Alternative phone number must be in +234XXXXXXXXXX format');
            return true;
        }),
    body('position').optional().isString().withMessage('Invalid position'),
    body('department').notEmpty().withMessage('Department is required'),
    body('branch').notEmpty().withMessage('Branch is required'),
    body('role').notEmpty().withMessage('Role is required'),
];
