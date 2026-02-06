import { Request, Response, NextFunction } from "express";
import { authService } from "../services/user-management.service";
import { successResponse } from "../../../shared/utils";
import { CreateAdminUserDto, CreateDepartmentDto, CreateRoleDto, DepartmentQueryDto, RoleQueryDto, UpdateDepartmentDto, UpdateRoleDto } from "../dto/user-management.dto";
import { asyncHandler } from "../../../shared/middleware";

class UserManagementController {
    addUser = asyncHandler(async (req: Request, res: Response) => {
        const body: CreateAdminUserDto = req.body;
        const result = await authService.addUser(body);
        res.json(successResponse(result));
    });

    login = asyncHandler(async (req: Request, res: Response) => {
        const { email, password } = req.body;
        const result = await authService.initiateLogin(email, password);
        res.json(successResponse(result));
    });

    verifyLogin = asyncHandler(async (req: Request, res: Response) => {
        const { email, otp } = req.body;
        const result = await authService.verifyLogin(email, otp);
        res.json(successResponse(result));
    });

    forgotPassword = asyncHandler(async (req: Request, res: Response) => {
        const { email } = req.body;
        const result = await authService.forgotPassword(email);
        res.json(successResponse(result));
    });

    resetPassword = asyncHandler(async (req: Request, res: Response) => {
        const { otp, password } = req.body;
        const result = await authService.resetPassword(otp, password);
        res.json(successResponse(result));
    });

    getAllUsers = asyncHandler(async (req: Request, res: Response) => {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const result = await authService.getAllUsers(page, limit);
        res.json(successResponse(result));
    });

    getProfile = asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user?.userId;
        const result = await authService.getProfile(userId);
        res.json(successResponse(result));
    });

    createRole = asyncHandler(async (req: Request, res: Response) => {
        const body: CreateRoleDto = req.body;
        const result = await authService.createRole(body);
        res.json(successResponse(result));
    });

    getRoles = asyncHandler(async (req: Request, res: Response) => {
        const query: RoleQueryDto = {
            page: req.query.page ? Number(req.query.page) : undefined,
            limit: req.query.limit ? Number(req.query.limit) : undefined,
            search: req.query.search as string,
            isActive: req.query.isActive as any,
        };

        const result = await authService.getAllRoles(query);
        res.json(successResponse(result));
    });

    getRole = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const result = await authService.getRole(id);
        res.json(successResponse(result));
    });

    updateRole = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const body: UpdateRoleDto = req.body;
        const result = await authService.updateRole(id, body);
        res.json(successResponse(result));
    });

    deleteRole = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const result = await authService.deleteRole(id);
        res.json(successResponse(result));
    });

    createDepartment = asyncHandler(async (req: Request, res: Response) => {
        const body: CreateDepartmentDto = req.body;
        const result = await authService.createDepartment(body);
        res.json(successResponse(result));
    });

    getDepartments = asyncHandler(async (req: Request, res: Response) => {
        const query: DepartmentQueryDto = {
            page: req.query.page ? Number(req.query.page) : undefined,
            limit: req.query.limit ? Number(req.query.limit) : undefined,
            search: req.query.search as string,
            isActive: req.query.isActive as any,
        };

        const result = await authService.getAllDepartments(query);
        res.json(successResponse(result));
    });

    getDepartment = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const result = await authService.getDepartment(id);
        res.json(successResponse(result));
    });

    updateDepartment = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const body: UpdateDepartmentDto = req.body;
        const result = await authService.updateDepartment(id, body);
        res.json(successResponse(result));
    });

    deleteDepartment = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const result = await authService.deleteDepartment(id);
        res.json(successResponse(result));
    });
}

export const userManagementController = new UserManagementController();
