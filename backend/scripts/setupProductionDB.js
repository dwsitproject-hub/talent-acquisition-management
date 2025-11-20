/**
 * Production Database Setup Script
 * 
 * This script sets up the production database with the specified credentials:
 * - Username: tasadmin
 * - Password: tasadminkpn@2025
 * - Database: tas_db
 * 
 * Usage:
 *   DATABASE_URL=postgresql://postgres:postgres_password@localhost:5432/postgres node setupProductionDB.js
 */

const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

const prisma = new PrismaClient();

async function setupProductionDatabase() {
  try {
    console.log('🚀 Starting production database setup...\n');

    // Get the database URL from environment
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    // Parse the database URL to get connection details
    const url = new URL(databaseUrl.replace('postgresql://', 'http://'));
    const adminUser = url.username || 'postgres';
    const adminPassword = url.password || '';
    const host = url.hostname || 'localhost';
    const port = url.port || '5432';
    const adminDb = url.pathname.slice(1) || 'postgres';

    console.log(`📊 Connecting to PostgreSQL server: ${host}:${port}`);
    console.log(`👤 Admin user: ${adminUser}`);
    console.log(`🗄️  Admin database: ${adminDb}\n`);

    // Production credentials
    const prodUser = 'tasadmin';
    const prodPassword = 'tasadminkpn@2025';
    const prodDatabase = 'tas_db';

    // Check if user already exists
    console.log('🔍 Checking if production user exists...');
    const userExists = await prisma.$queryRawUnsafe(`
      SELECT 1 FROM pg_user WHERE usename = $1
    `, prodUser).then(rows => rows.length > 0).catch(() => false);

    if (userExists) {
      console.log(`✅ User '${prodUser}' already exists`);
    } else {
      console.log(`➕ Creating production user '${prodUser}'...`);
      await prisma.$executeRawUnsafe(`
        CREATE USER ${prodUser} WITH PASSWORD '${prodPassword.replace(/'/g, "''")}';
      `);
      console.log(`✅ User '${prodUser}' created successfully`);
    }

    // Check if database already exists
    console.log('\n🔍 Checking if production database exists...');
    const dbExists = await prisma.$queryRawUnsafe(`
      SELECT 1 FROM pg_database WHERE datname = $1
    `, prodDatabase).then(rows => rows.length > 0).catch(() => false);

    if (dbExists) {
      console.log(`✅ Database '${prodDatabase}' already exists`);
    } else {
      console.log(`➕ Creating production database '${prodDatabase}'...`);
      await prisma.$executeRawUnsafe(`
        CREATE DATABASE ${prodDatabase} OWNER ${prodUser};
      `);
      console.log(`✅ Database '${prodDatabase}' created successfully`);
    }

    // Grant privileges
    console.log('\n🔐 Granting privileges...');
    await prisma.$executeRawUnsafe(`
      GRANT ALL PRIVILEGES ON DATABASE ${prodDatabase} TO ${prodUser};
    `);
    console.log('✅ Privileges granted');

    // Connect to the new database to set schema privileges
    console.log('\n🔗 Connecting to production database to set schema privileges...');
    const prodDbUrl = `postgresql://${prodUser}:${prodPassword}@${host}:${port}/${prodDatabase}`;
    const prodPrisma = new PrismaClient({
      datasources: {
        db: {
          url: prodDbUrl,
        },
      },
    });

    try {
      await prodPrisma.$connect();
      console.log('✅ Connected to production database');

      // Grant schema privileges
      await prodPrisma.$executeRawUnsafe(`
        GRANT ALL ON SCHEMA public TO ${prodUser};
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${prodUser};
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${prodUser};
      `);
      console.log('✅ Schema privileges granted');
    } catch (error) {
      console.warn('⚠️  Could not set schema privileges (may need to run migrations first):', error.message);
    } finally {
      await prodPrisma.$disconnect();
    }

    console.log('\n✅ Production database setup completed successfully!');
    console.log('\n📋 Production Database Credentials:');
    console.log(`   Username: ${prodUser}`);
    console.log(`   Password: ${prodPassword}`);
    console.log(`   Database: ${prodDatabase}`);
    console.log(`   Connection URL: postgresql://${prodUser}:${prodPassword}@${host}:${port}/${prodDatabase}`);
    console.log('\n⚠️  Next steps:');
    console.log('   1. Update DATABASE_URL in your production .env file');
    console.log('   2. Run database migrations: npx prisma migrate deploy');
    console.log('   3. Create initial admin user: node scripts/createProductionUser.js');

  } catch (error) {
    console.error('\n❌ Error setting up production database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the setup
setupProductionDatabase();

