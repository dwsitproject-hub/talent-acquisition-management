/**
 * Production User Creation Script
 *
 * Creates the initial SUPER_ADMIN user from environment variables.
 * Never hardcode credentials in this file.
 *
 * Required env vars:
 *   DATABASE_URL - application database connection string
 *   ADMIN_EMAIL - admin user email
 *   ADMIN_PASSWORD - initial password (user should change on first login)
 *
 * Optional:
 *   ADMIN_FIRST_NAME (default: Admin)
 *   ADMIN_LAST_NAME (default: User)
 *
 * Usage:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=your-secure-password \
 *   DATABASE_URL=postgresql://your_db_user:your_secure_db_password@localhost:5432/tas_db \
 *   node createProductionUser.js
 */

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createProductionUser() {
  try {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    const firstName = process.env.ADMIN_FIRST_NAME || 'Admin';
    const lastName = process.env.ADMIN_LAST_NAME || 'User';

    if (!email || !password) {
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required');
    }

    console.log('🚀 Creating production user...\n');

    const userData = {
      email,
      password,
      firstName,
      lastName,
      role: 'SUPER_ADMIN',
    };

    const existing = await prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (existing) {
      console.log(`⚠️  User already exists: ${userData.email}`);
      console.log('   User ID:', existing.id);
      console.log('   Role:', existing.role);
      console.log('\n   To update the user, please use the admin panel or update script.');
      return;
    }

    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(userData.password, 12);

    console.log('➕ Creating user in database...');
    const now = new Date();
    const result = await prisma.$queryRawUnsafe(`
      INSERT INTO users (
        id,
        email,
        password,
        "firstName",
        "lastName",
        "phoneNumber",
        role,
        department,
        division,
        pt,
        area,
        "areaDetail",
        "isActive",
        "isEmailVerified",
        "emailVerifiedAt",
        "lastLoginAt",
        "failedLoginCount",
        "lockedUntil",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        gen_random_uuid()::text,
        $1,
        $2,
        $3,
        $4,
        NULL,
        $5::userrole,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        true,
        true,
        $6,
        NULL,
        0,
        NULL,
        $7,
        $7
      )
      RETURNING id, email, "firstName", "lastName", role
    `,
      userData.email,
      hashedPassword,
      userData.firstName,
      userData.lastName,
      userData.role,
      now,
      now
    );

    const newUser = result[0];

    console.log('\n✅ Production user created successfully!');
    console.log('\n📋 User summary:');
    console.log(`   Name: ${userData.firstName} ${userData.lastName}`);
    console.log(`   Email: ${userData.email}`);
    console.log(`   Role: ${userData.role}`);
    console.log(`   User ID: ${newUser.id}`);
    console.log('\n⚠️  Security Note:');
    console.log('   Change the password after first login.');
    console.log('   Do not reuse this password elsewhere.');

  } catch (error) {
    console.error('\n❌ Error creating production user:', error);
    if (error.code === 'P2002') {
      console.error('   User with this email already exists.');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createProductionUser();
