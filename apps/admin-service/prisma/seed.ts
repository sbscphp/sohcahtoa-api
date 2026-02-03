import { PrismaClient } from '@prisma/client';
import { hashPassword } from '@fx-platform/shared-utils';

const prisma = new PrismaClient();

async function main() {
    const superAdminEmail = 'sohcahtoa@yopmail.com';
    const superAdminPassword = 'password@123';

    console.log('Starting seed...');

    // Create or update the SUPER_ADMIN role
    const superAdminRole = await prisma.role.upsert({
        where: { name: 'SUPER_ADMIN' },
        update: {
            permissions: ['*'], // Full access
            description: 'Super administrator with full access to all system features',
        },
        create: {
            name: 'SUPER_ADMIN',
            description: 'Super administrator with full access to all system features',
            permissions: ['*'],
            branch: 'GLOBAL',
            department: 'MANAGEMENT',
        },
    });

    console.log(`Role Created/Updated: ${superAdminRole.name}`);

    // Hash password
    const hashedPassword = await hashPassword(superAdminPassword);

    // Create or update the Super Admin user
    const superAdmin = await prisma.adminUser.upsert({
        where: { email: superAdminEmail },
        update: {
            password: hashedPassword,
            roleId: superAdminRole.id,
            fullName: 'System Super Admin',
            isActive: true,
        },
        create: {
            email: superAdminEmail,
            fullName: 'System Super Admin',
            password: hashedPassword,
            phoneNumber: '+2340000000000',
            department: 'MANAGEMENT',
            branch: 'HEAD_QUARTERS',
            roleId: superAdminRole.id,
            isActive: true,
        },
    });

    console.log(`Super Admin User Created/Updated: ${superAdmin.email}`);
    console.log('Seed completed successfully.');
}

main()
    .catch((e) => {
        console.error('Error during seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
