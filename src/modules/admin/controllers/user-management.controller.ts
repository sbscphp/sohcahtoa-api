import { Request, Response, NextFunction } from "express";
import { userManagementService } from "../services/user-management.service";
import { successResponse } from "../../../shared/utils";
import { CreateAdminUserDto, CreateDepartmentDto, CreateRoleDto, DepartmentQueryDto, RoleQueryDto, UpdateDepartmentDto, UpdateRoleDto } from "../dto/user-management.dto";
import { asyncHandler } from "../../../shared/middleware";

class UserManagementController {
    addUser = asyncHandler(async (req: Request, res: Response) => {
        const body: CreateAdminUserDto = req.body;
        const result = await userManagementService.addUser(body);
        res.json(successResponse(result));
    });

    getAllUsers = asyncHandler(async (req: Request, res: Response) => {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const result = await userManagementService.getAllUsers(page, limit);
        res.json(successResponse(result.data, { pagination: result.meta }));
    });

    getUserStats = asyncHandler(async (_req: Request, res: Response) => {
        const result = await userManagementService.getUserStats();
        res.json(successResponse(result));
    });

    getProfile = asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user?.userId;
        const result = await userManagementService.getProfile(userId);
        res.json(successResponse(result));
    });

    createRole = asyncHandler(async (req: Request, res: Response) => {
        const body: CreateRoleDto = req.body;
        const result = await userManagementService.createRole(body);
        res.json(successResponse(result));
    });

    getRoles = asyncHandler(async (req: Request, res: Response) => {
        const query: RoleQueryDto = {
            page: req.query.page ? Number(req.query.page) : undefined,
            limit: req.query.limit ? Number(req.query.limit) : undefined,
            search: req.query.search as string,
            isActive: req.query.isActive as any,
        };

        const result = await userManagementService.getAllRoles(query);
        res.json(successResponse(result.data, { pagination: result.meta }));
    });

    getRoleStats = asyncHandler(async (_req: Request, res: Response) => {
        const result = await userManagementService.getRoleStats();
        res.json(successResponse(result));
    });

    getRole = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const result = await userManagementService.getRole(id);
        res.json(successResponse(result));
    });

    updateRole = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const body: UpdateRoleDto = req.body;
        const result = await userManagementService.updateRole(id, body);
        res.json(successResponse(result));
    });

    deleteRole = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const result = await userManagementService.deleteRole(id);
        res.json(successResponse(result));
    });

    getRolePermissions = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const format = (req.query.format as string) === "flat" ? "flat" : "grouped";
        const result = await userManagementService.getRolePermissions(id, format as any);
        res.json(successResponse(result));
    });

    createDepartment = asyncHandler(async (req: Request, res: Response) => {
        const body: CreateDepartmentDto = req.body;
        const result = await userManagementService.createDepartment(body);
        res.json(successResponse(result));
    });

    getDepartments = asyncHandler(async (req: Request, res: Response) => {
        const query: DepartmentQueryDto = {
            page: req.query.page ? Number(req.query.page) : undefined,
            limit: req.query.limit ? Number(req.query.limit) : undefined,
            search: req.query.search as string,
            isActive: req.query.isActive as any,
        };

        const result = await userManagementService.getAllDepartments(query);
        res.json(successResponse(result.data, { pagination: result.meta }));
    });

    getDepartment = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const result = await userManagementService.getDepartment(id);
        res.json(successResponse(result));
    });

    updateDepartment = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const body: UpdateDepartmentDto = req.body;
        const result = await userManagementService.updateDepartment(id, body);
        res.json(successResponse(result));
    });

    deleteDepartment = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const result = await userManagementService.deleteDepartment(id);
        res.json(successResponse(result));
    });
    getDepartmentStats = asyncHandler(async (_req: Request, res: Response) => {
        const result = await userManagementService.getDepartmentStats();
        res.json(successResponse(result));
    });
}

export const userManagementController = new UserManagementController();
