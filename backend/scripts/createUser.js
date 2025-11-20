const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.EMAIL;
  const password = process.env.PASSWORD || 'DefaultPassword123!';
  const role = process.env.ROLE || 'HIRING_MANAGER';
  const firstName = process.env.FIRST_NAME || 'User';
  const lastName = process.env.LAST_NAME || 'Account';
  const department = process.env.DEPARTMENT || null;
  const division = process.env.DIVISION || null;

  if (!email) {
    console.error('EMAIL env var is required');
    process.exit(1);
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`User already exists: ${email}`);
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Use raw SQL to bypass enum naming drift (userrole vs "UserRole")
    const now = new Date();
    await prisma.$executeRawUnsafe(
      `INSERT INTO users (id, email, password, "firstName", "lastName", "phoneNumber", role, department, division, "isActive", "isEmailVerified", "emailVerifiedAt", "lastLoginAt", "failedLoginCount", "lockedUntil", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6::userrole, $7, $8, true, true, $9, NULL, 0, NULL, $10, $10)`,
      email,
      hashedPassword,
      firstName,
      lastName,
      null,
      role,
      department,
      division,
      now,
      now
    );

    console.log('✅ User created');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('👤 Role:', role);
  } catch (err) {
    console.error('❌ Failed to create user:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();


