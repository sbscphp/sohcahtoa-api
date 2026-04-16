import { Request, Response, NextFunction } from "express";
import { userManagementService } from "../services/user-management.service";
import { successResponse } from "../../../shared/utils";
import { streamCsv, toCsvValue } from "../../../shared/utils";
import { CreateAdminUserDto, CreateDepartmentDto, CreateRoleDto, DepartmentQueryDto, RoleQueryDto, UpdateDepartmentDto, UpdateRoleDto, AdminUserQueryDto } from "../dto/user-management.dto";
import { asyncHandler } from "../../../shared/middleware";
import adminService from "../services/admin.service";
import { auditTrailService } from "../services/audit-trail.service";
import { UpdateAdminUserDto } from "../dto/user-management.dto";
import { ActionType } from "../../../shared/types/action-type";

class UserManagementController {
    addUser = asyncHandler(async (req: Request, res: Response) => {
        const body: CreateAdminUserDto = req.body;
        const result = await userManagementService.addUser(body);
        const adminId = (req as any).user?.userId as string;
        await auditTrailService.logAction({
            adminId,
            actionType: ActionType.ADMIN_USER_CREATE,
            actionLabel: "Create Admin User",
            resourceType: "USER_MANAGEMENT",
            resourceId: result.user.id,
            departmentId: result.user.departmentId || undefined,
            metadata: { email: result.user.email, fullName: result.user.fullName },
        });
        res.json(successResponse(result));
    });

    updateUser = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const body: UpdateAdminUserDto = req.body;
        const result = await userManagementService.updateUser(id, body);
        const adminId = (req as any).user?.userId as string;
        await auditTrailService.logAction({
            adminId,
            actionType: ActionType.ADMIN_USER_UPDATE,
            actionLabel: "Update Admin User",
            resourceType: "USER_MANAGEMENT",
            resourceId: id,
            departmentId: result.user.departmentId || undefined,
            metadata: body,
        });
        res.json(successResponse(result));
    });

    toggleUserActive = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const isActiveRaw = (req.body?.isActive ?? req.query?.isActive) as any;
        const reason = (req.body?.reason ?? req.query?.reason) as any;
        const isActive = typeof isActiveRaw === "boolean" ? isActiveRaw : String(isActiveRaw) === "true";
        const result = await userManagementService.toggleUserActive(id, isActive);
        const adminId = (req as any).user?.userId as string;
        await auditTrailService.logAction({
            adminId,
            actionType: isActive ? ActionType.ADMIN_USER_ACTIVATE : ActionType.ADMIN_USER_SUSPEND,
            actionLabel: isActive ? "Activate Admin User" : "Suspend Admin User",
            resourceType: "USER_MANAGEMENT",
            resourceId: id,
            departmentId: result.user.departmentId || undefined,
            reason: reason || undefined,
            metadata: { previous: !isActive, new: isActive },
        });
        res.json(successResponse(result));
    });

    getAllUsers = asyncHandler(async (req: Request, res: Response) => {
        const query: AdminUserQueryDto = {
            page: req.query.page ? Number(req.query.page) : 1,
            limit: req.query.limit ? Number(req.query.limit) : 10,
            search: req.query.search as string,
            fullName: req.query.fullName as string,
            email: req.query.email as string,
            role: req.query.role as string,
            department: req.query.department as string,
            isActive: req.query.isActive as any,
        };

        const result = await userManagementService.getAllUsers(query);
        res.json(successResponse(result.data, { pagination: result.meta }));
    });

    listAllUsers = asyncHandler(async (req: Request, res: Response) => {
        const q = ((req.query.search as string) || "").toString();
        const items = await userManagementService.listUsersAll(q);
        res.json(successResponse(items));
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
        const adminId = (req as any).user?.userId as string;
        const result = await userManagementService.createRole(body, adminId);
        
        await auditTrailService.logAction({
            adminId,
            actionType: ActionType.ROLE_CREATE,
            actionLabel: "Create Role",
            resourceType: "USER_MANAGEMENT",
            resourceId: result.id,
            metadata: { name: result.name },
        });
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
        const adminId = (req as any).user?.userId as string;
        await auditTrailService.logAction({
            adminId,
            actionType: ActionType.ROLE_UPDATE,
            actionLabel: "Update Role",
            resourceType: "USER_MANAGEMENT",
            resourceId: id,
            metadata: body,
        });
        res.json(successResponse(result));
    });

    toggleRoleActive = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const isActiveRaw = (req.body?.isActive ?? req.query?.isActive) as any;
        const isActive = typeof isActiveRaw === "boolean" ? isActiveRaw : String(isActiveRaw) === "true";
        const result = await userManagementService.toggleRoleActive(id, isActive);
        const adminId = (req as any).user?.userId as string;
        await auditTrailService.logAction({
            adminId,
            actionType: ActionType.ROLE_UPDATE,
            actionLabel: isActive ? "Activate Role" : "Deactivate Role",
            resourceType: "USER_MANAGEMENT",
            resourceId: id,
            metadata: { previous: !isActive, new: isActive },
        });
        res.json(successResponse(result));
    });

    deleteRole = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const result = await userManagementService.deleteRole(id);
        const adminId = (req as any).user?.userId as string;
        await auditTrailService.logAction({
            adminId,
            actionType: ActionType.ROLE_DELETE,
            actionLabel: "Delete Role",
            resourceType: "USER_MANAGEMENT",
            resourceId: id,
        });
        res.json(successResponse(result));
    });

    getRolePermissions = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const format = (req.query.format as string) === "flat" ? "flat" : "grouped";
        const result = await userManagementService.getRolePermissions(id, format as any);
        res.json(successResponse(result));
    });

    getUser = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const result = await userManagementService.getUser(id);
        res.json(successResponse(result));
    });

    getUserActivities = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const result = await adminService.getAdminActions(id, page, limit);
        res.json(successResponse(result));
    });

    exportUserActivitiesCsv = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const rows = await adminService.getAdminActionsAll(id);
        streamCsv(
            res,
            `admin-user-${id}-activities.csv`,
            [
                { header: "id", select: (r: any) => r.id },
                { header: "performedAt", select: (r: any) => r.performedAt },
                { header: "actionLabel", select: (r: any) => r.actionLabel },
                { header: "actionType", select: (r: any) => r.actionType },
                { header: "resourceType", select: (r: any) => r.resourceType },
                { header: "resourceId", select: (r: any) => r.resourceId },
                { header: "status", select: (r: any) => r.status },
            ],
            rows as any[]
        );
    });

    getLookups = asyncHandler(async (req: Request, res: Response) => {
        const typeParam = (req.query.type as string | undefined)?.toLowerCase();
        const queryParam = (req.query.query as string | undefined)?.toLowerCase();
        const selected = queryParam || typeParam;
        const type = selected === "role" ? "role" : selected === "department" ? "department" : selected === "branch" ? "branch" : undefined;
        const result = await userManagementService.getLookups(type as any);
        res.json(successResponse(result));
    });

    exportUsersCsv = asyncHandler(async (_req: Request, res: Response) => {
        const rows = await userManagementService.exportUsers();
        streamCsv(
            res,
            "admin-users.csv",
            [
                { header: "id", select: (r: any) => r.id },
                { header: "fullName", select: (r: any) => r.fullName },
                { header: "email", select: (r: any) => r.email },
                { header: "phoneNumber", select: (r: any) => r.phoneNumber },
                { header: "roleName", select: (r: any) => r.roleName },
                { header: "departmentName", select: (r: any) => r.departmentName },
                { header: "isActive", select: (r: any) => r.isActive },
                { header: "createdAt", select: (r: any) => r.createdAt },
            ],
            rows as any[]
        );
    });

    exportRolesCsv = asyncHandler(async (_req: Request, res: Response) => {
        const rows = await userManagementService.exportRoles();
        streamCsv(
            res,
            "admin-roles.csv",
            [
                { header: "id", select: (r: any) => r.id },
                { header: "name", select: (r: any) => r.name },
                { header: "description", select: (r: any) => r.description },
                { header: "branch", select: (r: any) => r.branch },
                { header: "departmentName", select: (r: any) => r.departmentName },
                { header: "createdBy", select: (r: any) => r.createdBy },
                { header: "createdById", select: (r: any) => r.createdById },
                { header: "isDefault", select: (r: any) => r.isDefault },
                { header: "isActive", select: (r: any) => r.isActive },
                { header: "createdAt", select: (r: any) => r.createdAt },
            ],
            rows as any[]
        );
    });

    exportDepartmentsCsv = asyncHandler(async (_req: Request, res: Response) => {
        const rows = await userManagementService.exportDepartments();
        streamCsv(
            res,
            "admin-departments.csv",
            [
                { header: "id", select: (r: any) => r.id },
                { header: "name", select: (r: any) => r.name },
                { header: "departmentEmail", select: (r: any) => r.departmentEmail },
                { header: "description", select: (r: any) => r.description },
                { header: "branch", select: (r: any) => r.branch },
                { header: "createdBy", select: (r: any) => r.createdBy },
                { header: "createdById", select: (r: any) => r.createdById },
                { header: "isActive", select: (r: any) => r.isActive },
                { header: "createdAt", select: (r: any) => r.createdAt },
            ],
            rows as any[]
        );
    });

    createDepartment = asyncHandler(async (req: Request, res: Response) => {
        const body: CreateDepartmentDto = req.body;
        const adminId = (req as any).user?.userId as string;
        const result = await userManagementService.createDepartment(body, adminId);
        
        await auditTrailService.logAction({
            adminId,
            actionType: ActionType.DEPARTMENT_CREATE,
            actionLabel: "Create Department",
            resourceType: "USER_MANAGEMENT",
            resourceId: result.id,
            metadata: { name: result.name },
        });
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
        const adminId = (req as any).user?.userId as string;
        await auditTrailService.logAction({
            adminId,
            actionType: ActionType.DEPARTMENT_UPDATE,
            actionLabel: "Update Department",
            resourceType: "USER_MANAGEMENT",
            resourceId: id,
            metadata: body,
        });
        res.json(successResponse(result));
    });

    deleteDepartment = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const result = await userManagementService.deleteDepartment(id);
        const adminId = (req as any).user?.userId as string;
        await auditTrailService.logAction({
            adminId,
            actionType: ActionType.DEPARTMENT_DELETE,
            actionLabel: "Delete Department",
            resourceType: "USER_MANAGEMENT",
            resourceId: id,
        });
        res.json(successResponse(result));
    });

    getDepartmentStats = asyncHandler(async (_req: Request, res: Response) => {
        const result = await userManagementService.getDepartmentStats();
        res.json(successResponse(result));
    });

    toggleDepartmentActive = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const isActiveRaw = (req.body?.isActive ?? req.query?.isActive) as any;
        const isActive = typeof isActiveRaw === "boolean" ? isActiveRaw : String(isActiveRaw) === "true";
        const result = await userManagementService.toggleDepartmentActive(id, isActive);
        const adminId = (req as any).user?.userId as string;
        await auditTrailService.logAction({
            adminId,
            actionType: ActionType.DEPARTMENT_UPDATE,
            actionLabel: isActive ? "Activate Department" : "Deactivate Department",
            resourceType: "USER_MANAGEMENT",
            resourceId: id,
            metadata: { previous: !isActive, new: isActive },
        });
        res.json(successResponse(result));
    });
    getPermissions = asyncHandler(async (req: Request, res: Response) => {
        const query = {
            search: req.query.search as string,
            module: req.query.module as string,
            featureKey: req.query.featureKey as string,
            action: req.query.action as string,
            isActive: req.query.isActive as any,
        };
        const result = await userManagementService.getAllPermissions(query);
        res.json(successResponse(result));
    });

    getPermissionModules = asyncHandler(async (_req: Request, res: Response) => {
        const modules = [
            "TRANSACTION",
            "CUSTOMER",
            "OUTLET",
            "SETTLEMENT",
            "WORKFLOW",
            "INCIDENCE",
            "RATE",
            "USER_ANAGEMENT",
            "REGULATORY",    
            "REPORTS",
            "AUDIT_TRAIL",
        ];
        res.json(successResponse({ modules }));
    });
}

export const userManagementController = new UserManagementController();
