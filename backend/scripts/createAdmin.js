const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    // Check if admin user already exists
    const existingAdmin = await prisma.user.findFirst({
      where: {
        OR: [
          { email: 'admin@kpn.com' },
          { role: 'SUPER_ADMIN' }
        ]
      }
    });

    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.email);
      return;
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash('Admin123!', 12);
    
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@kpn.com',
        password: hashedPassword,
        firstName: 'System',
        lastName: 'Administrator',
        phoneNumber: '+62-21-12345678',
        role: 'SUPER_ADMIN',
        department: 'Human Resources',
        division: 'Talent Acquisition',
        isActive: true,
        emailVerified: true,
        lastLoginAt: new Date(),
      }
    });

    console.log('✅ Admin user created successfully!');
    console.log('📧 Email:', adminUser.email);
    console.log('🔑 Password: Admin123!');
    console.log('👤 Role:', adminUser.role);
    console.log('🆔 User ID:', adminUser.id);

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createAdminUser();
