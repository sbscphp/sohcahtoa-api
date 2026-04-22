import { PrismaClient } from "@prisma/client";
import { userManagementService } from "./src/modules/admin/services/user-management.service";
import * as dotenv from "dotenv";

dotenv.config();

async function verify() {
    const prisma = new PrismaClient();
    
    try {
        console.log("--- Starting Default Role Verification ---");

        // 1. Create two test roles
        console.log("Creating Test Role A...");
        const roleA = await prisma.role.create({
            data: {
                name: "Test Role A " + Date.now(),
                permissions: {},
                isDefault: false,
                isActive: true
            }
        });

        console.log("Creating Test Role B...");
        const roleB = await prisma.role.create({
            data: {
                name: "Test Role B " + Date.now(),
                permissions: {},
                isDefault: false,
                isActive: true
            }
        });

        // 2. Set Role A as default
        console.log("Setting Role A as default...");
        await userManagementService.setDefaultRole(roleA.id);

        let updatedA = await prisma.role.findUnique({ where: { id: roleA.id } });
        console.log(`Role A isDefault: ${updatedA?.isDefault}`);

        // 3. Set Role B as default
        console.log("Setting Role B as default...");
        await userManagementService.setDefaultRole(roleB.id);

        updatedA = await prisma.role.findUnique({ where: { id: roleA.id } });
        let updatedB = await prisma.role.findUnique({ where: { id: roleB.id } });
        
        console.log(`Role A isDefault: ${updatedA?.isDefault}`);
        console.log(`Role B isDefault: ${updatedB?.isDefault}`);

        // 4. Assertions
        if (updatedA?.isDefault === false && updatedB?.isDefault === true) {
            console.log("SUCCESS: Default role correctly switched!");
        } else {
            console.log("FAILURE: Default role state mismatch.");
        }

        // Cleanup
        console.log("Cleaning up test roles...");
        await prisma.role.delete({ where: { id: roleA.id } });
        await prisma.role.delete({ where: { id: roleB.id } });

    } catch (err) {
        console.error("Verification failed:", err);
    } finally {
        await prisma.$disconnect();
    }
}

verify();
