import { getDatabase } from "../src/config/database";
import { createLogger } from "../src/shared/utils/logger";
import { hashPassword } from "../src/shared/utils/password";

const logger = createLogger("PrismaSeed");
const prisma = getDatabase();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "sohcahtoa@yopmail.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "password@1234";
  const fullName = process.env.SEED_ADMIN_NAME || "Local Super Admin";

  logger.info("Starting Prisma seed...");

  let defaultRole = await prisma.role.findFirst({
    where: { isDefault: true },
  });

  if (!defaultRole) {
    defaultRole = await prisma.role.create({
      data: {
        name: "SUPER_ADMIN",
        description: "Default super admin role",
        permissions: [],
        isDefault: true,
        isActive: true,
        branch: "Head Office",
        department: "Administration",
      } as any,
    });
    logger.info("Created default SUPER_ADMIN role", { roleId: defaultRole.id });
  }

  const existing = await prisma.adminUser.findUnique({
    where: { email: adminEmail },
  });

  if (existing) {
    logger.info("Admin user already exists", { email: adminEmail });
    return;
  }

  const passwordHash = await hashPassword(adminPassword);

  const admin = await prisma.adminUser.create({
    data: {
      email: adminEmail,
      fullName,
      phoneNumber: "08000000000",
      branch: "Head Office",
      departmentName: "Administration",
      roleId: defaultRole.id,
      role: "SUPER_ADMIN" as any,
      password: passwordHash,
      isActive: true,
    } as any,
  });

  logger.info("Seeded SUPER_ADMIN user", { email: admin.email, id: admin.id });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    logger.error("Seed failed", e);
    await prisma.$disconnect();
    process.exit(1);
  });
