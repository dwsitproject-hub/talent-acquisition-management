/**
 * Migration Script: LocalStorage to Database
 * 
 * This script migrates data from localStorage (frontend) to the database.
 * It reads localStorage data from a JSON file and inserts it into the database.
 * 
 * Usage:
 *   1. Export localStorage data from browser console:
 *      JSON.stringify({
 *        candidates: localStorage.getItem('candidates'),
 *        jobPostings: localStorage.getItem('jobPostings'),
 *        masterDivisions: localStorage.getItem('masterDivisions'),
 *        masterOfficeLocations: localStorage.getItem('masterOfficeLocations'),
 *        teamMembers: localStorage.getItem('teamMembers'),
 *        applications: localStorage.getItem('applications'),
 *      })
 * 
 *   2. Save to backend/data/localStorage-export.json
 * 
 *   3. Run: node backend/scripts/migrateLocalStorageToDB.js
 */

// Load environment variables
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Try multiple paths for .env file
const scriptDir = __dirname; // scripts/
const backendDir = path.join(scriptDir, '..'); // backend/
const envPath = path.join(backendDir, '.env'); // backend/.env

// Load .env file
if (fs.existsSync(envPath)) {
  const result = dotenv.config({ path: envPath, override: true });
  if (result.error) {
    console.error('Error loading .env file:', result.error);
  } else {
    console.log('Loaded .env from:', envPath);
  }
} else {
  // Fallback: try current directory
  const cwdResult = dotenv.config({ override: true });
  if (cwdResult.error) {
    console.error('Error loading .env from current directory:', cwdResult.error);
  }
}

// Also try loading from process.cwd() (where script is run from)
if (!process.env.DATABASE_URL) {
  const cwdEnvPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(cwdEnvPath)) {
    const cwdResult = dotenv.config({ path: cwdEnvPath, override: true });
    if (!cwdResult.error) {
      console.log('Loaded .env from:', cwdEnvPath);
    }
  }
}

// Verify DATABASE_URL is loaded, if not try manual parsing
if (!process.env.DATABASE_URL) {
  // Try manual parsing of .env file
  try {
    if (fs.existsSync(envPath)) {
      // Try UTF-8 first, then UTF-16LE if that fails
      let envContent;
      try {
        envContent = fs.readFileSync(envPath, 'utf8');
        // Check if it looks like UTF-16 (has null bytes between characters)
        if (envContent.length > 0 && envContent.charCodeAt(0) === 0xFFFE || envContent.includes('\0')) {
          throw new Error('Looks like UTF-16, will retry');
        }
      } catch (e) {
        // Try UTF-16LE (Windows default)
        try {
          envContent = fs.readFileSync(envPath, 'utf16le');
        } catch (e2) {
          // Fallback to UTF-8
          envContent = fs.readFileSync(envPath, 'utf8');
        }
      }
      
      // Handle both Unix and Windows line endings
      const envLines = envContent.split(/\r?\n/);
      for (const line of envLines) {
        const trimmed = line.trim();
        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        // Match DATABASE_URL=value (with or without spaces around =)
        const match = trimmed.match(/^DATABASE_URL\s*=\s*(.+)$/);
        if (match) {
          let value = match[1].trim();
          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          process.env.DATABASE_URL = value;
          console.log('Manually loaded DATABASE_URL from .env file');
          break;
        }
      }
    }
  } catch (e) {
    console.error('Error manually parsing .env file:', e.message);
  }
}

// Final check
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not found in environment variables!');
  console.error('Checked paths:');
  console.error('  -', envPath);
  console.error('  -', path.join(process.cwd(), '.env'));
  console.error('Please ensure .env file exists in backend/ directory with DATABASE_URL set.');
  process.exit(1);
}

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Path to localStorage export file
const DATA_FILE = path.join(__dirname, '../data/localStorage-export.json');

/**
 * Migrate Master Divisions
 */
async function migrateMasterDivisions(data) {
  if (!data.masterDivisions) {
    console.log('No master divisions data found');
    return;
  }

  // Handle if data is already parsed or needs parsing
  let divisions;
  if (typeof data.masterDivisions === 'string') {
    try {
      divisions = JSON.parse(data.masterDivisions);
    } catch (e) {
      console.log('Invalid master divisions JSON, skipping...');
      return;
    }
  } else {
    divisions = data.masterDivisions;
  }
  
  if (!Array.isArray(divisions) || divisions.length === 0) {
    console.log('No master divisions to migrate');
    return;
  }
  console.log(`\nMigrating ${divisions.length} master divisions...`);

  let created = 0;
  let skipped = 0;

  for (const division of divisions) {
    try {
      await prisma.masterDivision.upsert({
        where: {
          divisionName_sectionName: {
            divisionName: division.divisionName,
            sectionName: division.sectionName,
          },
        },
        update: {
          headOfDivisionName: division.headOfDivisionName,
          hiringManagerName: division.hiringManagerName || '',
        },
        create: {
          divisionName: division.divisionName,
          sectionName: division.sectionName,
          headOfDivisionName: division.headOfDivisionName,
          hiringManagerName: division.hiringManagerName || '',
        },
      });
      created++;
    } catch (error) {
      console.error(`Error migrating division ${division.id}:`, error.message);
      skipped++;
    }
  }

  console.log(`✓ Master divisions: ${created} created/updated, ${skipped} skipped`);
}

/**
 * Migrate Master Office Locations
 */
async function migrateMasterOfficeLocations(data) {
  if (!data.masterOfficeLocations) {
    console.log('No master office locations data found');
    return;
  }

  // Handle if data is already parsed or needs parsing
  let officeLocations;
  if (typeof data.masterOfficeLocations === 'string') {
    try {
      officeLocations = JSON.parse(data.masterOfficeLocations);
    } catch (e) {
      console.log('Invalid master office locations JSON, skipping...');
      return;
    }
  } else {
    officeLocations = data.masterOfficeLocations;
  }
  
  if (!Array.isArray(officeLocations) || officeLocations.length === 0) {
    console.log('No master office locations to migrate');
    return;
  }
  console.log(`\nMigrating ${officeLocations.length} master office locations...`);

  let created = 0;
  let skipped = 0;

  for (const location of officeLocations) {
    try {
      // Handle missing 'pt' field in old data - use empty string or 'N/A' as default
      const pt = location.pt || location.PT || 'N/A';
      const area = location.area || '';
      const areaDetail = location.areaDetail || '';
      
      await prisma.masterOfficeLocation.upsert({
        where: {
          pt_area_areaDetail: {
            pt: pt,
            area: area,
            areaDetail: areaDetail,
          },
        },
        update: {
          pt: pt,
          area: area,
          areaDetail: areaDetail,
        },
        create: {
          pt: pt,
          area: area,
          areaDetail: areaDetail,
        },
      });
      created++;
    } catch (error) {
      console.error(`Error migrating office location ${location.id}:`, error.message);
      skipped++;
    }
  }

  console.log(`✓ Master office locations: ${created} created/updated, ${skipped} skipped`);
}

/**
 * Migrate FPTK (Job Postings)
 */
async function migrateFPTKs(data) {
  if (!data.jobPostings) {
    console.log('No job postings data found');
    return;
  }

  // Handle if data is already parsed or needs parsing
  let jobPostings;
  if (typeof data.jobPostings === 'string') {
    try {
      jobPostings = JSON.parse(data.jobPostings);
    } catch (e) {
      console.log('Invalid job postings JSON, skipping...');
      return;
    }
  } else {
    jobPostings = data.jobPostings;
  }
  
  if (!Array.isArray(jobPostings) || jobPostings.length === 0) {
    console.log('No job postings to migrate');
    return;
  }
  console.log(`\nMigrating ${jobPostings.length} FPTKs (job postings)...`);

  // Get a default user for createdBy (use first SUPER_ADMIN or TA_TEAM)
  // Use raw SQL to avoid Prisma client cache issues
  let defaultUserId = null;
  try {
    const result = await prisma.$queryRaw`
      SELECT id FROM users 
      WHERE role::text IN ('SUPER_ADMIN', 'TA_TEAM')
      LIMIT 1
    `;
    if (result && result.length > 0) {
      defaultUserId = result[0].id;
    } else {
      console.log('No default user found, will use null for createdBy');
    }
  } catch (e) {
    console.log('Could not find default user, will use null for createdBy:', e.message);
  }

  let created = 0;
  let skipped = 0;

  for (const job of jobPostings) {
    try {
      // Generate FPTK number if not exists
      let fptkNumber = job.fptkNumber || job.noFktk || `FPTK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Map status
      let status = 'DRAFT';
      if (job.status) {
        const statusMap = {
          'draft': 'DRAFT',
          'active': 'OPEN',
          'paused': 'DRAFT',
          'closed': 'FILLED',
          'cancelled': 'CANCELLED',
        };
        status = statusMap[job.status.toLowerCase()] || 'DRAFT';
      }

      // Map priority
      let priority = job.priority || job.urgentNormal;
      if (priority && !['P0', 'P1', 'P2'].includes(priority)) {
        // Convert old priority format to new format
        const priorityMap = {
          'urgent': 'P0',
          'high': 'P1',
          'medium': 'P2',
          'low': 'P2',
        };
        priority = priorityMap[priority.toLowerCase()] || 'P2';
      }

      await prisma.fPTK.upsert({
        where: { fptkNumber },
        update: {
          pt: job.pt,
          noFktk: job.noFktk || fptkNumber,
          statusFktk: job.statusFktk,
          division: job.division || job.department,
          section: job.section,
          hiringManager: job.hiringManager,
          position: job.position || job.title,
          positionTitle: job.position || job.title,
          department: job.department || job.division,
          location: job.location || job.area,
          employmentType: job.employmentType || job.type,
          typeGrade: job.typeGrade,
          grade2: job.grade2,
          level: job.level || job.typeGrade,
          priority: priority,
          priorityByMonthYear: job.priorityByMonthYear,
          isPriority: priority === 'P0',
          jobSpecification: job.jobSpecification || job.description,
          criteria: job.criteria,
          area: job.area,
          areaDetail: job.areaDetail,
          additionalOrReplacement: job.additionalOrReplacement,
          replacementName: job.replacementName,
          resignReason: job.resignReason,
          totalRequest: job.totalRequest ? parseInt(job.totalRequest) : 1,
          currentStatus: job.currentStatus || job.statusFktk,
          requestDate: job.requestDate ? new Date(job.requestDate) : new Date(),
          numberOfPositions: job.numberOfPositions || job.totalRequest ? parseInt(job.totalRequest) : 1,
          status: status,
          remark: job.remark,
        },
        create: {
          fptkNumber,
          pt: job.pt,
          noFktk: job.noFktk || fptkNumber,
          statusFktk: job.statusFktk,
          division: job.division || job.department,
          section: job.section,
          hiringManager: job.hiringManager,
          position: job.position || job.title,
          positionTitle: job.position || job.title,
          department: job.department || job.division,
          location: job.location || job.area,
          employmentType: job.employmentType || job.type,
          typeGrade: job.typeGrade,
          grade2: job.grade2,
          level: job.level || job.typeGrade,
          priority: priority,
          priorityByMonthYear: job.priorityByMonthYear,
          isPriority: priority === 'P0',
          jobSpecification: job.jobSpecification || job.description,
          criteria: job.criteria,
          area: job.area,
          areaDetail: job.areaDetail,
          additionalOrReplacement: job.additionalOrReplacement,
          replacementName: job.replacementName,
          resignReason: job.resignReason,
          totalRequest: job.totalRequest ? parseInt(job.totalRequest) : 1,
          currentStatus: job.currentStatus || job.statusFktk,
          requestDate: job.requestDate ? new Date(job.requestDate) : new Date(),
          numberOfPositions: job.numberOfPositions || job.totalRequest ? parseInt(job.totalRequest) : 1,
          status: status,
          createdBy: defaultUserId,
          remark: job.remark,
        },
      });
      created++;
    } catch (error) {
      console.error(`Error migrating FPTK ${job.id}:`, error.message);
      skipped++;
    }
  }

  console.log(`✓ FPTKs: ${created} created/updated, ${skipped} skipped`);
}

/**
 * Migrate Candidates
 */
async function migrateCandidates(data) {
  if (!data.candidates) {
    console.log('No candidates data found');
    return;
  }

  // Handle if data is already parsed or needs parsing
  let candidates;
  if (typeof data.candidates === 'string') {
    try {
      candidates = JSON.parse(data.candidates);
    } catch (e) {
      console.log('Invalid candidates JSON, skipping...');
      return;
    }
  } else {
    candidates = data.candidates;
  }
  
  if (!Array.isArray(candidates) || candidates.length === 0) {
    console.log('No candidates to migrate');
    return;
  }
  console.log(`\nMigrating ${candidates.length} candidates...`);

  let created = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    try {
      // Get candidate email - this is the key identifier
      const userData = candidate.user || {};
      const email = userData.email || candidate.contactInfo?.email || `candidate-${candidate.id}@example.com`;
      const firstName = userData.firstName || candidate.personalInfo?.firstName || '';
      const lastName = userData.lastName || candidate.personalInfo?.lastName || '';

      // Check if user with this email already exists
      let user = await prisma.user.findUnique({ where: { email } });
      let userId;
      
      if (user) {
        // User exists, check if candidate already exists for this user
        const existingCandidate = await prisma.candidate.findUnique({ where: { userId: user.id } });
        if (existingCandidate) {
          // Candidate already exists, skip
          console.log(`Skipping candidate ${candidate.id}: Candidate already exists for user ${email}`);
          skipped++;
          continue;
        }
        userId = user.id;
      } else {
        // Create new user for this candidate
        // Generate a new UUID for the user
        const { v4: uuidv4 } = require('uuid');
        userId = uuidv4();
        const hashedPassword = await bcrypt.hash('TempPassword123!', 10);
        
        // Create user using raw SQL to avoid Prisma enum issues
        try {
          const result = await prisma.$queryRawUnsafe(
            `INSERT INTO users (id, email, "firstName", "lastName", password, role, "isEmailVerified", "emailVerifiedAt", "isActive", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, 'CANDIDATE'::userrole, $6, NOW(), $7, NOW(), NOW())
             RETURNING *`,
            userId,
            email,
            firstName,
            lastName,
            hashedPassword,
            userData.isEmailVerified || false,
            userData.isActive !== false
          );
          if (result && result.length > 0) {
            user = result[0];
          }
        } catch (createError) {
          // If user creation fails, try to find by email (might have been created concurrently)
          const foundUser = await prisma.user.findUnique({ where: { email } });
          if (foundUser) {
            userId = foundUser.id;
            user = foundUser;
          } else {
            throw createError;
          }
        }
      }

      // Map candidate data
      const personalInfo = candidate.personalInfo || {};
      const contactInfo = candidate.contactInfo || {};
      const professionalInfo = candidate.professionalInfo || {};

      // Create or update candidate
      const candidateUpdateData = {
        dateOfBirth: personalInfo.dateOfBirth ? new Date(personalInfo.dateOfBirth) : null,
        gender: personalInfo.gender && personalInfo.gender !== 'Not specified' ? personalInfo.gender : null,
        nationality: personalInfo.nationality || null,
        currentAddress: contactInfo.address && contactInfo.address !== 'Not specified' ? contactInfo.address : null,
        currentJobTitle: professionalInfo.currentPosition || null,
        currentCompany: professionalInfo.currentCompany || null,
        skills: Array.isArray(professionalInfo.skills) ? professionalInfo.skills : (Array.isArray(candidate.skills) ? candidate.skills : []),
        drivingLicense: Array.isArray(candidate.drivingLicense) ? candidate.drivingLicense : [],
      };
      
      const candidateCreateData = {
        ...candidateUpdateData,
        userId: userId,
      };
      
      // Use candidate.id for upsert if available, otherwise use userId
      // This ensures each candidate is unique even if they share the same userId
      const candidateId = candidate.id || userId;
      if (candidate.id) {
        candidateCreateData.id = candidate.id;
      }

      // Try to upsert by candidate id first, then by userId as fallback
      try {
        await prisma.candidate.upsert({
          where: { id: candidateId },
          update: candidateUpdateData,
          create: candidateCreateData,
        });
      } catch (error) {
        // If upsert by id fails (e.g., id doesn't exist), try by userId
        // But create a new unique id for the candidate
        if (error.code === 'P2002' || error.message.includes('Unique constraint')) {
          // Generate a new UUID for the candidate
          const { v4: uuidv4 } = require('uuid');
          candidateCreateData.id = uuidv4();
          await prisma.candidate.create({
            data: candidateCreateData,
          });
        } else {
          throw error;
        }
      }
      created++;
    } catch (error) {
      console.error(`Error migrating candidate ${candidate.id}:`, error.message);
      if (error.code) {
        console.error(`  Error code: ${error.code}`);
      }
      if (error.meta) {
        console.error(`  Error meta:`, JSON.stringify(error.meta));
      }
      skipped++;
    }
  }

  console.log(`✓ Candidates: ${created} created/updated, ${skipped} skipped`);
}

/**
 * Main migration function
 */
async function main() {
  console.log('Starting migration from localStorage to database...\n');

  // Check if data file exists
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`Error: Data file not found at ${DATA_FILE}`);
    console.log('\nPlease create the data file with the following structure:');
    console.log('1. Export localStorage data from browser console');
    console.log('2. Save to backend/data/localStorage-export.json');
    process.exit(1);
  }

  // Read and parse data file
  const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
  const data = JSON.parse(fileContent);

  try {
    // Migrate in order (masters first, then dependent data)
    await migrateMasterDivisions(data);
    await migrateMasterOfficeLocations(data);
    await migrateCandidates(data);
    await migrateFPTKs(data);

    console.log('\n✓ Migration completed successfully!');
  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
if (require.main === module) {
  main()
    .catch((error) => {
      console.error('Migration error:', error);
      process.exit(1);
    });
}

module.exports = { main };

