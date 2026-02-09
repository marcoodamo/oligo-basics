import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const email = 'marco_damo@hotmail.com';
    const password = 'oligo@2026'; // Known password from context
    const passwordHash = await bcrypt.hash(password, 10);

    console.log(`Creating/Updating admin with email: ${email}`);

    // Ensure organization exists
    let org = await prisma.organization.findFirst({
        where: { slug: 'oligo-basics' }
    });

    if (!org) {
        console.log('Organization not found, creating one...');
        org = await prisma.organization.create({
            data: {
                name: 'Oligo Basics',
                slug: 'oligo-basics',
            }
        });
    }

    const user = await prisma.user.upsert({
        where: { email },
        update: {
            passwordHash,
            organizationId: org.id,
            role: 'ADMIN',
            name: 'Marco Admin'
        },
        create: {
            email,
            name: 'Marco Admin',
            passwordHash,
            role: 'ADMIN',
            organizationId: org.id,
        },
    });

    console.log('Admin user created/updated successfully:', user.id);
}

main()
    .catch((e) => {
        console.error('Error creating admin:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
