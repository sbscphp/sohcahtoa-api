import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

export const validate = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
        return next();
    }

    const extractedErrors: any[] = [];
    errors.array().forEach(err => extractedErrors.push({ [err.type === 'field' ? err.path : 'unknown']: err.msg }));

    return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: extractedErrors,
    });
};

export const createWorkflowValidation = [
    body('name').notEmpty().withMessage('Workflow name is required'),
    body('type').isIn(['REVIEW', 'APPROVAL']).withMessage('Invalid workflow type'),
    body('processType').optional().isIn(['RIGID_LINEAR', 'FLEXIBLE']).withMessage('Invalid process type'),
    body('hasPtaRequest').optional().isBoolean().withMessage('hasPtaRequest must be a boolean'),
    body('transactionType').optional().isString().withMessage('transactionType must be a string'),
    body('stages').isArray({ min: 1 }).withMessage('At least one stage is required'),
    body('stages.*.id').optional().isUUID().withMessage('Invalid stage ID'),
    body('stages.*.order').isInt({ min: 1 }).withMessage('Stage order must be at least 1'),
    body('stages.*.assignees').isArray({ min: 1 }).withMessage('At least one assignee is required for each stage'),
    body('stages.*.assignees.*.id').optional().isUUID().withMessage('Invalid assignee ID'),
    body('stages.*.assignees.*.adminId').isUUID().withMessage('Invalid admin ID'),
];
