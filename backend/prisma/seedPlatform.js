/**
 * Bootstraps the very first Developer account (the platform owner).
 * This is the ONLY way a Developer account is ever created — there is no
 * HTTP endpoint for it, by design. Run once when standing up a new
 * deployment, then log in at POST /api/v1/platform/auth/login.
 *
 * Run: BOOTSTRAP_DEVELOPER_EMAIL=you@company.com BOOTSTRAP_DEVELOPER_PASSWORD=... npm run seed:platform
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.BOOTSTRAP_DEVELOPER_EMAIL;
  const password = process.env.BOOTSTRAP_DEVELOPER_PASSWORD;

  if (!email || !password) {
    console.error(
      '❌ Set BOOTSTRAP_DEVELOPER_EMAIL and BOOTSTRAP_DEVELOPER_PASSWORD env vars before running this script.'
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('❌ BOOTSTRAP_DEVELOPER_PASSWORD must be at least 8 characters.');
    process.exit(1);
  }

  const existing = await prisma.platformUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`ℹ️  A platform account with email ${email} already exists (role: ${existing.role}). Nothing to do.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const dev = await prisma.platformUser.create({
    data: {
      email,
      passwordHash,
      firstName: 'Platform',
      lastName: 'Owner',
      role: 'Developer',
    },
  });

  console.log(`✅ Developer account created: ${dev.email} (id ${dev.id})`);
  console.log('   Log in at POST /api/v1/platform/auth/login, then create a SuperAdmin via POST /api/v1/platform/super-admins.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
