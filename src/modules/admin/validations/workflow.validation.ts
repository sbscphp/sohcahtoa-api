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
    body('type').notEmpty().withMessage('Workflow type is required').isString().withMessage('Workflow type must be a string'),
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

export const createStageTypeValidation = [
    body('name').notEmpty().withMessage('Stage type name is required').isString().withMessage('Stage type name must be a string'),
    body('description').optional().isString().withMessage('Description must be a string'),
];

export const updateStageTypeValidation = [
    body('name').notEmpty().withMessage('Stage type name is required').isString().withMessage('Stage type name must be a string'),
    body('description').optional().isString().withMessage('Description must be a string'),
];

