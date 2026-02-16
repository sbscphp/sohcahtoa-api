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

  // Create default role
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

  // Seed admin user
  const existing = await prisma.adminUser.findUnique({
    where: { email: adminEmail },
  });

  if (!existing) {
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
  } else {
    logger.info("Admin user already exists", { email: adminEmail });
  }

  // Seed mock Nigerian customer
  const nigerianEmail = "nigerian@yopmail.com";
  const existingNigerian = await prisma.user.findUnique({
    where: { email: nigerianEmail },
  });

  if (!existingNigerian) {
    const passwordHash = await hashPassword("password@1234");

    const nigerianUser = await prisma.user.create({
      data: {
        email: nigerianEmail,
        password: passwordHash,
        phoneNumber: "+2348012345678",
        role: "CUSTOMER",
        customerType: "NIGERIAN_CITIZEN",
        emailVerified: true,
        phoneVerified: true,
        isActive: true,
        profile: {
          create: {
            firstName: "Chinedu",
            lastName: "Okafor",
            dateOfBirth: new Date("1990-05-15"),
            address: "123 Lagos Street",
            city: "Lagos",
            state: "Lagos",
            country: "Nigeria",
            postalCode: "100001",
          },
        },
        kyc: {
          create: {
            status: "VERIFIED",
            bvn: "12345678901",
            bvnVerified: true,
            verifiedAt: new Date(),
          },
        },
      },
    });

    logger.info("Seeded Nigerian customer", { email: nigerianUser.email, id: nigerianUser.id });
  } else {
    logger.info("Nigerian customer already exists", { email: nigerianEmail });
  }

  // Seed mock Tourist customer
  const touristEmail = "tourist@yopmail.com";
  const existingTourist = await prisma.user.findUnique({
    where: { email: touristEmail },
  });

  if (!existingTourist) {
    const passwordHash = await hashPassword("password@1234");

    const touristUser = await prisma.user.create({
      data: {
        email: touristEmail,
        password: passwordHash,
        phoneNumber: "+447700900123",
        role: "CUSTOMER",
        customerType: "TOURIST",
        emailVerified: true,
        phoneVerified: true,
        isActive: true,
        profile: {
          create: {
            firstName: "John",
            lastName: "Smith",
            dateOfBirth: new Date("1985-03-20"),
            address: "456 London Road",
            city: "London",
            state: "England",
            country: "United Kingdom",
            postalCode: "SW1A 1AA",
          },
        },
        kyc: {
          create: {
            status: "VERIFIED",
            passportNumber: "GB123456789",
            passportDocumentUrl: "https://example.com/passport/gb123.jpg",
            passportVerified: true,
            verifiedAt: new Date(),
          },
        },
      },
    });

    logger.info("Seeded Tourist customer", { email: touristUser.email, id: touristUser.id });
  } else {
    logger.info("Tourist customer already exists", { email: touristEmail });
  }

  // Seed mock Expatriate customer
  const expatriateEmail = "expatriate@yopmail.com";
  const existingExpatriate = await prisma.user.findUnique({
    where: { email: expatriateEmail },
  });

  if (!existingExpatriate) {
    const passwordHash = await hashPassword("password@1234");

    const expatriateUser = await prisma.user.create({
      data: {
        email: expatriateEmail,
        password: passwordHash,
        phoneNumber: "+2348087654321",
        role: "CUSTOMER",
        customerType: "EXPATRIATE",
        emailVerified: true,
        phoneVerified: true,
        isActive: true,
        profile: {
          create: {
            firstName: "Maria",
            lastName: "Garcia",
            dateOfBirth: new Date("1988-08-12"),
            address: "789 Victoria Island",
            city: "Lagos",
            state: "Lagos",
            country: "Spain",
            postalCode: "101001",
          },
        },
        kyc: {
          create: {
            status: "VERIFIED",
            passportNumber: "ES987654321",
            passportDocumentUrl: "https://example.com/passport/es987.jpg",
            passportVerified: true,
            verifiedAt: new Date(),
          },
        },
      },
    });

    logger.info("Seeded Expatriate customer", { email: expatriateUser.email, id: expatriateUser.id });
  } else {
    logger.info("Expatriate customer already exists", { email: expatriateEmail });
  }
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
