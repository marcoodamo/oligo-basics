import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Iniciando seed...");

    // Criar organização
    const org = await prisma.organization.upsert({
        where: { slug: "oligo-basics" },
        update: {},
        create: {
            name: "Oligo Basics",
            slug: "oligo-basics",
        },
    });

    console.log("✅ Organização criada:", org.name);

    // Hash da senha
    const passwordHash = await bcrypt.hash("oligo@2026", 12);

    // Criar usuários
    const users = [
        {
            email: "marco_damo@hotmail.com",
            name: "Marco Damo",
            role: "ADMIN" as const,
        },
        {
            email: "r.groberio@oligobasics.com.br",
            name: "R. Groberio",
            role: "ADMIN" as const,
        },
    ];

    for (const userData of users) {
        const user = await prisma.user.upsert({
            where: { email: userData.email },
            update: {
                name: userData.name,
                role: userData.role,
                passwordHash,
            },
            create: {
                email: userData.email,
                name: userData.name,
                role: userData.role,
                passwordHash,
                organizationId: org.id,
            },
        });

        console.log(`✅ Usuário criado: ${user.email} (${user.role})`);
    }

    console.log("🎉 Seed concluído!");
}

main()
    .catch((e) => {
        console.error("❌ Erro no seed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
