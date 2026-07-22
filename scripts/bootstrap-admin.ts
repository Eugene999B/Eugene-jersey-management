import "dotenv/config";

import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL ?? ""),
});

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function optionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

async function main() {
  const email = requiredEnv("ADMIN_EMAIL").toLowerCase();
  const password = requiredEnv("ADMIN_PASSWORD");
  const adminLoginId = (optionalEnv("ADMIN_LOGIN_ID") ?? "YPMS-ADMIN-ROOT").toUpperCase();
  const name = optionalEnv("ADMIN_NAME") ?? "Platform Super Admin";
  const phone = optionalEnv("ADMIN_PHONE");

  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters for production bootstrap.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && (existing.role !== Role.SUPER_ADMIN || existing.shopId)) {
    throw new Error("ADMIN_EMAIL already belongs to a tenant account and cannot be promoted by bootstrap.");
  }
  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      adminLoginId,
      passwordHash,
      name,
      phone,
      role: Role.SUPER_ADMIN,
      shopId: null,
      isActive: true,
      failedLoginCount: 0,
      lockUntil: null,
      staffTitle: "Platform Super Admin",
      department: "Platform Command",
    },
    create: {
      adminLoginId,
      email,
      passwordHash,
      name,
      phone,
      role: Role.SUPER_ADMIN,
      isActive: true,
      staffTitle: "Platform Super Admin",
      department: "Platform Command",
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "admin.bootstrap",
      entityType: "User",
      entityId: admin.id,
      metadata: { email, adminLoginId },
    },
  });

  console.log(`Platform admin ready: ${adminLoginId} / ${email}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
