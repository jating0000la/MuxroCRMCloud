import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as bcrypt from 'bcryptjs';
import * as schema from './schema';
import { users } from './schema';
import { eq } from 'drizzle-orm';

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool, { schema });

  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123';
  const userPassword = process.env.SEED_USER_PASSWORD || 'user123';
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const userEmail = process.env.SEED_USER_EMAIL || 'user@example.com';

  // Upsert admin
  const [existingAdmin] = await db
    .select()
    .from(users)
    .where(eq(users.username, 'admin'))
    .limit(1);

  if (!existingAdmin) {
    const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
    await db.insert(users).values({
      username: 'admin',
      password: hashedAdminPassword,
      name: 'System Admin',
      email: adminEmail,
      role: 'ADMIN',
    });
  }

  // Upsert user
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.username, 'user1'))
    .limit(1);

  if (!existingUser) {
    const hashedUserPassword = await bcrypt.hash(userPassword, 10);
    await db.insert(users).values({
      username: 'user1',
      password: hashedUserPassword,
      name: 'Sales User',
      email: userEmail,
      role: 'USER',
    });
  }

  console.log('Seed data created successfully');

  await pool.end();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
