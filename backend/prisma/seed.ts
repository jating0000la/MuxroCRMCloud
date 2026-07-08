import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123';
  const userPassword = process.env.SEED_USER_PASSWORD || 'user123';
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const userEmail = process.env.SEED_USER_EMAIL || 'user@example.com';

  const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedAdminPassword,
      name: 'System Admin',
      email: adminEmail,
      role: 'ADMIN',
    },
  });

  const hashedUserPassword = await bcrypt.hash(userPassword, 10);
  await prisma.user.upsert({
    where: { username: 'user1' },
    update: {},
    create: {
      username: 'user1',
      password: hashedUserPassword,
      name: 'Sales User',
      email: userEmail,
      role: 'USER',
    },
  });

  console.log('Seed data created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
