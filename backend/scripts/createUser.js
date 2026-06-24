const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.EMAIL;
  const password = process.env.PASSWORD;
  const role = process.env.ROLE || 'HIRING_MANAGER';
  const firstName = process.env.FIRST_NAME || 'User';
  const lastName = process.env.LAST_NAME || 'Account';
  const department = process.env.DEPARTMENT || null;
  const division = process.env.DIVISION || null;

  if (!email || !password) {
    console.error('EMAIL and PASSWORD env vars are required');
    process.exit(1);
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`User already exists: ${email}`);
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Use Prisma client to avoid enum name mismatch
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phoneNumber: null,
        role, // Prisma will map enum correctly (UserRole)
        department,
        division,
        isActive: true,
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        lastLoginAt: null,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });

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


