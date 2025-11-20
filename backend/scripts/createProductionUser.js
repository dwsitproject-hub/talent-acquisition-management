/**
 * Production User Creation Script
 * 
 * Creates the initial production user:
 * - First Name: Jerry
 * - Last Name: Hakim
 * - Email: jerry.hakim@energi-up.com
 * - Password: DefaultPassword123!
 * - Role: SUPER_ADMIN
 * 
 * Usage:
 *   DATABASE_URL=postgresql://tasadmin:tasadminkpn@2025@localhost:5432/tas_db node createProductionUser.js
 */

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createProductionUser() {
  try {
    console.log('🚀 Creating production user...\n');

    const userData = {
      email: 'jerry.hakim@energi-up.com',
      password: 'DefaultPassword123!',
      firstName: 'Jerry',
      lastName: 'Hakim',
      role: 'SUPER_ADMIN',
    };

    // Check if user already exists
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

    // Hash password
    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(userData.password, 12);

    // Create user using raw SQL to avoid enum issues
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
    console.log('\n📋 User Credentials:');
    console.log(`   Name: ${userData.firstName} ${userData.lastName}`);
    console.log(`   Email: ${userData.email}`);
    console.log(`   Password: ${userData.password}`);
    console.log(`   Role: ${userData.role}`);
    console.log(`   User ID: ${newUser.id}`);
    console.log('\n⚠️  Security Note:');
    console.log('   Please change the password after first login!');
    console.log('   The default password should not be used in production.');

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

// Run the script
createProductionUser();

