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

  const branchName = "Head Office";
  const departmentName = "Administration";

  const department =
    (await prisma.department.findFirst({ where: { name: departmentName } })) ||
    (await prisma.department.create({
      data: {
        name: departmentName,
        description: "Default administration department",
        branch: branchName,
        isActive: true,
      },
    }));

  let defaultRole = await prisma.role.findFirst({ where: { isDefault: true } });

  if (!defaultRole) {
    defaultRole = await prisma.role.create({
      data: {
        name: "SUPER_ADMIN",
        description: "Default super admin role",
        permissions: [],
        isDefault: true,
        isActive: true,
        branch: branchName,
        departmentId: department.id,
      },
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
      branch: branchName,
      departmentId: department.id,
      roleId: defaultRole.id,
      password: passwordHash,
      isActive: true,
    },
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
