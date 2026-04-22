import { userManagementService } from "./src/modules/admin/services/user-management.service";
import { PrismaClient } from "@prisma/client";

async function verify() {
    const prisma = new PrismaClient();
    
    try {
        console.log("--- Starting Verification ---");

        // 1. Get total active permissions count
        const totalPermissions = await prisma.permission.count({ where: { isActive: true } });
        console.log(`Total active permissions in DB: ${totalPermissions}`);

        if (totalPermissions === 0) {
            console.log("No permissions found in DB. Please run seed first or add permissions.");
            return;
        }

        // 2. Find or create SUPER_ADMIN role
        let superAdminRole = await prisma.role.findUnique({ where: { name: "SUPER_ADMIN" } });
        if (!superAdminRole) {
            console.log("Creating SUPER_ADMIN role for testing...");
            superAdminRole = await prisma.role.create({
                data: {
                    name: "SUPER_ADMIN",
                    permissions: {},
                    isActive: true
                }
            });
        }

        // 3. Test getRolePermissions (grouped)
        console.log("Testing getRolePermissions (grouped)...");
        const grouped = await userManagementService.getRolePermissions(superAdminRole.id, "grouped") as any;
        
        let groupedCount = 0;
        for (const mod of Object.keys(grouped)) {
            for (const feat of Object.keys(grouped[mod])) {
                groupedCount += grouped[mod][feat].length;
            }
        }
        console.log(`Grouped permissions count: ${groupedCount}`);

        // 4. Test getRolePermissions (flat)
        console.log("Testing getRolePermissions (flat)...");
        const flat = await userManagementService.getRolePermissions(superAdminRole.id, "flat") as any[];
        console.log(`Flat permissions count: ${flat.length}`);

        // 5. Assertions
        if (flat.length === totalPermissions && groupedCount === totalPermissions) {
            console.log("SUCCESS: Super Admin received all active permissions!");
        } else {
            console.log("FAILURE: Permission count mismatch.");
            console.log(`Expected: ${totalPermissions}, Got: ${flat.length} (flat), ${groupedCount} (grouped)`);
        }

    } catch (err) {
        console.error("Verification failed:", err);
    } finally {
        await prisma.$disconnect();
    }
}

verify();
