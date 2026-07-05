import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      name: 'System Admin',
      email: 'admin@crm.com',
      role: 'ADMIN',
    },
  });

  const managerPassword = await bcrypt.hash('manager123', 10);
  await prisma.user.upsert({
    where: { username: 'manager1' },
    update: {},
    create: {
      username: 'manager1',
      password: managerPassword,
      name: 'Campaign Manager',
      email: 'manager@crm.com',
      role: 'MANAGER',
    },
  });

  const userPassword = await bcrypt.hash('user123', 10);
  await prisma.user.upsert({
    where: { username: 'user1' },
    update: {},
    create: {
      username: 'user1',
      password: userPassword,
      name: 'Sales User',
      email: 'user@crm.com',
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
