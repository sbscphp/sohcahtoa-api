import { Request, Response, NextFunction } from "express";
import { userManagementService } from "../services/user-management.service";
import { successResponse } from "../../../shared/utils";
import { CreateAdminUserDto, CreateDepartmentDto, CreateRoleDto, DepartmentQueryDto, RoleQueryDto, UpdateDepartmentDto, UpdateRoleDto } from "../dto/user-management.dto";
import { asyncHandler } from "../../../shared/middleware";
import adminService from "../services/admin.service";
import { auditTrailService } from "../services/audit-trail.service";

class UserManagementController {
    addUser = asyncHandler(async (req: Request, res: Response) => {
        const body: CreateAdminUserDto = req.body;
        const result = await userManagementService.addUser(body);
        const adminId = (req as any).user?.userId as string;
        await auditTrailService.logAction({
            adminId,
            actionType: "ADMIN_USER_CREATE",
            actionLabel: "Create Admin User",
            resourceType: "ADMIN_USER",
            resourceId: result.user.id,
            departmentId: result.user.departmentId || undefined,
            metadata: { email: result.user.email, fullName: result.user.fullName },
        });
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
        const adminId = (req as any).user?.userId as string;
        await auditTrailService.logAction({
            adminId,
            actionType: "ROLE_CREATE",
            actionLabel: "Create Role",
            resourceType: "ROLE",
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
            actionType: "ROLE_UPDATE",
            actionLabel: "Update Role",
            resourceType: "ROLE",
            resourceId: id,
            metadata: body,
        });
        res.json(successResponse(result));
    });

    deleteRole = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const result = await userManagementService.deleteRole(id);
        const adminId = (req as any).user?.userId as string;
        await auditTrailService.logAction({
            adminId,
            actionType: "ROLE_DELETE",
            actionLabel: "Delete Role",
            resourceType: "ROLE",
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
        const headers = ["id","performedAt","actionLabel","actionType","resourceType","resourceId","status"];
        const csv =
            headers.join(",") + "\n" +
            rows.map((r: any) => [
                r.id,
                new Date(r.performedAt).toISOString(),
                r.actionLabel ? `"${String(r.actionLabel).replace(/"/g, '""')}"` : "",
                r.actionType,
                r.resourceType,
                r.resourceId,
                r.status
            ].join(",")).join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="admin-user-${id}-activities.csv"`);
        res.send(csv);
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
        const headers = ["id","fullName","email","phoneNumber","roleName","departmentName","isActive","createdAt"];
        const csv =
            headers.join(",") + "\n" +
            rows.map((r: any) => [
                r.id,
                `"${(r.fullName || "").replace(/"/g, '""')}"`,
                r.email,
                r.phoneNumber,
                r.roleName || "",
                r.departmentName || "",
                r.isActive ? "true" : "false",
                new Date(r.createdAt).toISOString()
            ].join(",")).join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", 'attachment; filename="admin-users.csv"');
        res.send(csv);
    });

    exportRolesCsv = asyncHandler(async (_req: Request, res: Response) => {
        const rows = await userManagementService.exportRoles();
        const headers = ["id","name","description","branch","departmentName","isDefault","isActive","createdAt"];
        const csv =
            headers.join(",") + "\n" +
            rows.map((r: any) => [
                r.id,
                `"${(r.name || "").replace(/"/g, '""')}"`,
                `"${(r.description || "").replace(/"/g, '""')}"`,
                r.branch || "",
                r.departmentName || "",
                r.isDefault ? "true" : "false",
                r.isActive ? "true" : "false",
                new Date(r.createdAt).toISOString()
            ].join(",")).join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", 'attachment; filename="admin-roles.csv"');
        res.send(csv);
    });

    exportDepartmentsCsv = asyncHandler(async (_req: Request, res: Response) => {
        const rows = await userManagementService.exportDepartments();
        const headers = ["id","name","departmentEmail","description","branch","isActive","createdAt"];
        const csv =
            headers.join(",") + "\n" +
            rows.map((r: any) => [
                r.id,
                `"${(r.name || "").replace(/"/g, '""')}"`,
                r.departmentEmail || "",
                `"${(r.description || "").replace(/"/g, '""')}"`,
                r.branch || "",
                r.isActive ? "true" : "false",
                new Date(r.createdAt).toISOString()
            ].join(",")).join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", 'attachment; filename="admin-departments.csv"');
        res.send(csv);
    });

    createDepartment = asyncHandler(async (req: Request, res: Response) => {
        const body: CreateDepartmentDto = req.body;
        const result = await userManagementService.createDepartment(body);
        const adminId = (req as any).user?.userId as string;
        await auditTrailService.logAction({
            adminId,
            actionType: "DEPARTMENT_CREATE",
            actionLabel: "Create Department",
            resourceType: "DEPARTMENT",
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
            actionType: "DEPARTMENT_UPDATE",
            actionLabel: "Update Department",
            resourceType: "DEPARTMENT",
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
            actionType: "DEPARTMENT_DELETE",
            actionLabel: "Delete Department",
            resourceType: "DEPARTMENT",
            resourceId: id,
        });
        res.json(successResponse(result));
    });
    getDepartmentStats = asyncHandler(async (_req: Request, res: Response) => {
        const result = await userManagementService.getDepartmentStats();
        res.json(successResponse(result));
    });
}

export const userManagementController = new UserManagementController();
