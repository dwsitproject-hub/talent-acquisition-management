const prisma = require('../config/database');
const bcrypt = require('bcryptjs');
const { encrypt, decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');
const { buildTokenizedSearch } = require('../utils/search');
const {
  ACTIVE_CANDIDATE_WHERE,
  withActiveCandidate,
} = require('../utils/candidateVisibility');
const { enrichCandidatesWithApplicationLock, enrichCandidateWithApplicationLock } = require('../utils/candidateApplicationLock');

function buildHiringManagerScopeFromUser(user = null) {
  if (!user) return null;

  const firstName = String(user.firstName || '').trim();
  const lastName = String(user.lastName || '').trim();
  const email = String(user.email || '').trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  const values = Array.from(new Set([firstName, fullName, email].filter(Boolean)));
  if (values.length === 0) return null;

  return {
    OR: values.map((value) => ({
      hiringManager: { equals: value, mode: 'insensitive' },
    })),
  };
}

function parseFormDataDiri(candidate) {
  if (candidate && candidate.formDataDiri) {
    if (typeof candidate.formDataDiri === 'string') {
      try {
        candidate.formDataDiri = JSON.parse(candidate.formDataDiri);
      } catch (err) {
        logger.warn(`Failed to parse formDataDiri JSON for candidate ${candidate.id}: ${err.message}`);
        candidate.formDataDiri = null;
      }
    }
  }
  return candidate;
}

function parseYearsOfExperience(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = typeof value === 'number' ? value : parseInt(String(value).trim(), 10);
  if (Number.isNaN(num) || num < 0) return null;
  return num;
}

function applyYearsOfExperienceToLanguages(languagesData, yearsOfExperience) {
  if (yearsOfExperience === undefined) return;
  const parsed = parseYearsOfExperience(yearsOfExperience);
  if (parsed !== null) {
    languagesData.yearsOfExperience = parsed;
  } else {
    delete languagesData.yearsOfExperience;
  }
}

function parseLanguagesJson(languages) {
  if (!languages) return null;
  if (typeof languages === 'string') {
    try {
      return JSON.parse(languages);
    } catch (e) {
      return null;
    }
  }
  if (typeof languages === 'object' && languages !== null) return languages;
  return null;
}

function enrichCandidateFromLanguages(candidate) {
  const languages = parseLanguagesJson(candidate.languages);
  if (!languages || typeof languages !== 'object') {
    candidate.positionAppliedFor = [];
    candidate.ethnicity = null;
    candidate.healthStatus = null;
    candidate.divisionList = [];
    candidate.yearsOfExperience = null;
    return candidate;
  }

  candidate.languages = languages;
  candidate.positionAppliedFor = languages.positionAppliedFor || [];
  candidate.ethnicity = languages.ethnicity || null;
  candidate.healthStatus = languages.healthStatus || null;
  candidate.yearsOfExperience = parseYearsOfExperience(languages.yearsOfExperience);

  const divisionsValue = languages.divisions;
  let divisionsArray = [];
  if (Array.isArray(divisionsValue)) {
    divisionsArray = divisionsValue.map(item => String(item).trim()).filter(item => item.length > 0);
  } else if (divisionsValue !== undefined && divisionsValue !== null) {
    const trimmed = String(divisionsValue).trim();
    divisionsArray = trimmed ? [trimmed] : [];
  }
  candidate.languages.divisions = divisionsArray;
  candidate.divisionList = divisionsArray;

  return candidate;
}

/**
 * Create candidate (for TA/HR)
 */
async function createCandidate(data) {
  logger.info(`CREATE CANDIDATE - Received data:`, JSON.stringify(data, null, 2));
  
  const { 
    email, 
    firstName, 
    lastName, 
    phoneNumber, 
    division, 
    divisionList,
    positionAppliedFor, 
    yearsOfExperience, 
    height, 
    weight, 
    taxNumber, 
    bpjsNumber, 
    bloodType,
    idNumber,
    ethnicity,
    healthStatus,
    ...candidateData 
  } = data;
  
  logger.info(`CREATE CANDIDATE - Extracted fields:`, JSON.stringify({
    division,
    positionAppliedFor,
    ethnicity,
    healthStatus,
    placeOfBirth: candidateData.placeOfBirth,
    dateOfBirth: candidateData.dateOfBirth,
    gender: candidateData.gender,
    maritalStatus: candidateData.maritalStatus,
    currentAddress: candidateData.currentAddress,
    permanentAddress: candidateData.permanentAddress,
    position: candidateData.position,
    skills: candidateData.skills,
    drivingLicense: candidateData.drivingLicense,
    height,
    weight,
    taxNumber,
    bpjsNumber,
    bloodType,
    idNumber
  }, null, 2));

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error('Email already registered');
  }

  // Hash password (default password for candidates created by TA/HR)
  const hashedPassword = await bcrypt.hash('TempPassword123!', 12);

  // Calculate division value outside transaction for logging
  const normalizeDivisionArray = (value) => {
    if (Array.isArray(value)) {
      return value.map(item => String(item).trim()).filter(item => item.length > 0);
    }
    if (value === undefined || value === null) {
      return [];
    }
    const trimmed = String(value).trim();
    return trimmed ? [trimmed] : [];
  };

  const divisionsArray = divisionList !== undefined
    ? normalizeDivisionArray(divisionList)
    : normalizeDivisionArray(division);

  // Primary division stored on user record - make it optional
  const divisionValue = divisionsArray.length > 0 ? divisionsArray[0] : null;

  // Create user and candidate in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create user using raw SQL to avoid Prisma enum issues
    const escapeSql = (str) => (str || '').replace(/'/g, "''");
    const userId = require('crypto').randomUUID();
    
    const userSql = `
      INSERT INTO users (id, email, password, "firstName", "lastName", "phoneNumber", role, division, "isEmailVerified", "emailVerifiedAt", "isActive", "createdAt", "updatedAt")
      VALUES (
        '${userId}',
        '${escapeSql(email)}',
        '${escapeSql(hashedPassword)}',
        '${escapeSql(firstName)}',
        '${escapeSql(lastName)}',
        ${phoneNumber ? `'${escapeSql(phoneNumber)}'` : 'NULL'},
        'CANDIDATE'::"UserRole",
        ${divisionValue ? `'${escapeSql(divisionValue)}'` : 'NULL'},
        false,
        NULL,
        true,
        NOW(),
        NOW()
      )
      RETURNING *
    `;
    
    const userResult = await tx.$queryRawUnsafe(userSql);
    const user = userResult[0];

    // Encrypt nationalId if provided
    let encryptedNationalId = null;
    if (idNumber) {
      encryptedNationalId = encrypt(idNumber);
    }

    // Build languages JSON to store additional fields
    // Always include these fields if they're provided (even if empty)
    const languagesData = {};
    
    // Handle positionAppliedFor - save if provided (even if empty array)
    // Check if it's explicitly provided (not undefined) in the request
    if (positionAppliedFor !== undefined) {
      if (Array.isArray(positionAppliedFor)) {
        languagesData.positionAppliedFor = positionAppliedFor; // Save even if empty array
      } else if (positionAppliedFor !== null && positionAppliedFor !== '') {
        // If it's a string or other value, convert to array
        languagesData.positionAppliedFor = [String(positionAppliedFor)];
      } else {
        // If it's null or empty string, save as empty array
        languagesData.positionAppliedFor = [];
      }
    }
    
    // Handle ethnicity - save if provided (even if empty string to clear it)
    if (ethnicity !== undefined) {
      if (ethnicity && String(ethnicity).trim()) {
        languagesData.ethnicity = String(ethnicity).trim();
      } else {
        // Empty string or null means clear it
        languagesData.ethnicity = null;
      }
    }
    
    // Handle healthStatus - save if provided (even if empty string to clear it)
    if (healthStatus !== undefined) {
      if (healthStatus && String(healthStatus).trim()) {
        languagesData.healthStatus = String(healthStatus).trim();
      } else {
        // Empty string or null means clear it
        languagesData.healthStatus = null;
      }
    }

    // Handle divisions list (store all selected divisions)
    if (divisionList !== undefined || divisionsArray.length > 0) {
      languagesData.divisions = divisionsArray;
    }

    if (yearsOfExperience !== undefined) {
      applyYearsOfExperienceToLanguages(languagesData, yearsOfExperience);
    }
    
    logger.info(`Creating candidate with languagesData:`, JSON.stringify(languagesData, null, 2));
    logger.info(`PositionAppliedFor value:`, positionAppliedFor, `Type:`, typeof positionAppliedFor, `IsArray:`, Array.isArray(positionAppliedFor));

    // Handle drivingLicense - convert string to array if needed
    let drivingLicenseArray = [];
    if (candidateData.drivingLicense) {
      if (Array.isArray(candidateData.drivingLicense)) {
        drivingLicenseArray = candidateData.drivingLicense;
      } else if (typeof candidateData.drivingLicense === 'string') {
        // Try to parse "A & C" or "A,C" format
        drivingLicenseArray = candidateData.drivingLicense
          .split(/[&,]/)
          .map(lic => lic.trim())
          .filter(lic => lic.length > 0);
      }
    }

    // Map candidate data - handle empty strings by converting to null
    const candidateCreateData = {
      userId: user.id,
      nationalId: encryptedNationalId,
      placeOfBirth: candidateData.placeOfBirth && String(candidateData.placeOfBirth).trim() ? String(candidateData.placeOfBirth).trim() : null,
      dateOfBirth: candidateData.dateOfBirth ? new Date(candidateData.dateOfBirth) : null,
      gender: candidateData.gender && String(candidateData.gender).trim() ? String(candidateData.gender).trim() : null,
      maritalStatus: candidateData.maritalStatus && String(candidateData.maritalStatus).trim() ? String(candidateData.maritalStatus).trim() : null,
      currentAddress: candidateData.currentAddress && String(candidateData.currentAddress).trim() ? String(candidateData.currentAddress).trim() : null,
      permanentAddress: candidateData.permanentAddress && String(candidateData.permanentAddress).trim() ? String(candidateData.permanentAddress).trim() : null,
      currentJobTitle: candidateData.position && String(candidateData.position).trim() ? String(candidateData.position).trim() : null,
      skills: Array.isArray(candidateData.skills) ? candidateData.skills : [],
      drivingLicense: drivingLicenseArray,
      height: height && height !== '' ? (typeof height === 'string' ? parseInt(height) : height) : null,
      weight: weight && weight !== '' ? (typeof weight === 'string' ? parseInt(weight) : weight) : null,
      npwpNumber: taxNumber && String(taxNumber).trim() ? String(taxNumber).trim() : null,
      bpjsHealthNumber: bpjsNumber && String(bpjsNumber).trim() ? String(bpjsNumber).trim() : null,
      bloodType: bloodType && String(bloodType).trim() ? String(bloodType).trim() : null,
      // Always save languages if any of the fields were provided
      // If any field is provided (even if empty), save the languages object
      languages: (positionAppliedFor !== undefined || ethnicity !== undefined || healthStatus !== undefined || divisionList !== undefined || divisionsArray.length > 0 || yearsOfExperience !== undefined) 
        ? languagesData  // Always save languagesData if any field was provided (even if empty)
        : null,
    };
    
    logger.info(`Candidate createData:`, JSON.stringify({
      division: divisionValue,
      positionAppliedFor: languagesData.positionAppliedFor,
      ethnicity: languagesData.ethnicity,
      healthStatus: languagesData.healthStatus,
      languages: candidateCreateData.languages
    }, null, 2));

    const candidate = await tx.candidate.create({
      data: candidateCreateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phoneNumber: true,
            division: true,
          },
        },
      },
    });

    return { user, candidate };
  });

  logger.info(`New candidate created by TA/HR: ${email}`);
  logger.info(`Created candidate with division: ${divisionValue || 'null'}`);
  logger.info(`Created candidate with positionAppliedFor:`, JSON.stringify(positionAppliedFor || null));

  // Return candidate with parsed languages data
  const candidate = result.candidate;
  
  // Fetch the candidate again with user data to ensure we have division
  const candidateWithUser = await prisma.candidate.findUnique({
    where: { id: candidate.id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          division: true,
        },
      },
      documents: {
        orderBy: { uploadedAt: 'desc' },
      },
    },
  });
  
  if (!candidateWithUser) {
    throw new Error('Failed to retrieve created candidate');
  }
  
  // Decrypt sensitive fields
  if (candidateWithUser.nationalId) {
    try {
      candidateWithUser.nationalId = decrypt(candidateWithUser.nationalId);
    } catch (e) {
      logger.warn(`Failed to decrypt nationalId for candidate ${candidateWithUser.id}: ${e.message}`);
      candidateWithUser.nationalId = null;
    }
  }
  
  enrichCandidateFromLanguages(candidateWithUser);

  parseFormDataDiri(candidateWithUser);
  
  return candidateWithUser;
}

/**
 * Get candidate profile
 */
async function getCandidateProfile(candidateId, options = {}) {
  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, ...ACTIVE_CANDIDATE_WHERE },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          division: true,
        },
      },
      documents: {
        orderBy: { uploadedAt: 'desc' },
      },
      educations: true,
      workExperiences: {
        orderBy: { startDate: 'desc' },
      },
      certifications: true,
      references: true,
    },
  });

  if (!candidate) {
    throw new Error('Candidate not found');
  }

  // Decrypt sensitive fields
  if (candidate.nationalId) {
    candidate.nationalId = decrypt(candidate.nationalId);
  }

  enrichCandidateFromLanguages(candidate);

  parseFormDataDiri(candidate);

  return enrichCandidateWithApplicationLock(candidate, options.forFptkId || null, prisma);
}

/**
 * Get candidate by user ID
 */
async function getCandidateByUserId(userId) {
  const candidate = await prisma.candidate.findFirst({
    where: { userId, ...ACTIVE_CANDIDATE_WHERE },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          division: true,
        },
      },
      documents: {
        orderBy: { uploadedAt: 'desc' },
      },
      educations: true,
      workExperiences: {
        orderBy: { startDate: 'desc' },
      },
      certifications: true,
      references: true,
    },
  });

  if (!candidate) {
    throw new Error('Candidate profile not found');
  }

  // Decrypt sensitive fields
  if (candidate.nationalId) {
    candidate.nationalId = decrypt(candidate.nationalId);
  }

  enrichCandidateFromLanguages(candidate);

  parseFormDataDiri(candidate);

  return candidate;
}

/**
 * Update candidate profile
 */
async function updateCandidateProfile(candidateId, data) {
  const existing = await prisma.candidate.findFirst({
    where: { id: candidateId, ...ACTIVE_CANDIDATE_WHERE },
    select: { id: true },
  });
  if (!existing) {
    throw new Error('Candidate not found');
  }

  // Encrypt sensitive fields
  if (data.nationalId) {
    data.nationalId = encrypt(data.nationalId);
  }

  const candidate = await prisma.candidate.update({
    where: { id: candidateId },
    data,
  });

  logger.info(`Candidate profile updated: ${candidateId}`);

  return candidate;
}

/**
 * Update candidate (admin/TA side)
 */
async function updateCandidate(candidateId, data) {
  // Log incoming data for debugging
  logger.info(`Updating candidate ${candidateId} with data:`, JSON.stringify(data, null, 2));
  
  // Split fields that belong to user vs candidate
  const {
    email,
    firstName,
    lastName,
    phoneNumber,
    division,
    divisionList,
    positionAppliedFor,
    height,
    weight,
    taxNumber,
    bpjsNumber,
    bloodType,
    idNumber,
    ethnicity,
    healthStatus,
    yearsOfExperience,
    ...candidateData
  } = data;

  // Load candidate to get userId and existing data
  const existing = await prisma.candidate.findFirst({
    where: { id: candidateId, ...ACTIVE_CANDIDATE_WHERE },
    include: {
      user: {
        select: {
          id: true,
          division: true,
        },
      },
    },
  });
  if (!existing) throw new Error('Candidate not found');

  // Update user if provided
  if (email || firstName || lastName || phoneNumber || division !== undefined || divisionList !== undefined) {
    const escapeSql = (str) => (str || '').replace(/'/g, "''");
    
    const normalizeDivisionArray = (value) => {
      if (Array.isArray(value)) {
        return value.map(item => String(item).trim()).filter(item => item.length > 0);
      }
      if (value === undefined || value === null) {
        return [];
      }
      const trimmed = String(value).trim();
      return trimmed ? [trimmed] : [];
    };

    const divisionsArray = divisionList !== undefined
      ? normalizeDivisionArray(divisionList)
      : (division !== undefined ? normalizeDivisionArray(division) : normalizeDivisionArray(existing.user.division));

    let divisionValue;
    if (divisionList !== undefined) {
      divisionValue = divisionsArray.length > 0 ? divisionsArray[0] : null;
    } else if (division !== undefined) {
      divisionValue = divisionsArray.length > 0 ? divisionsArray[0] : null;
    } else {
      divisionValue = existing.user.division;
    }
    
    await prisma.$queryRawUnsafe(
      `UPDATE users SET 
         email = ${email ? `'${escapeSql(email)}'` : 'email'},
         "firstName" = ${firstName ? `'${escapeSql(firstName)}'` : '"firstName"'},
         "lastName" = ${lastName ? `'${escapeSql(lastName)}'` : '"lastName"'},
         "phoneNumber" = ${typeof phoneNumber !== 'undefined' && phoneNumber !== null ? `'${escapeSql(phoneNumber)}'` : (phoneNumber === null ? 'NULL' : '"phoneNumber"')},
         division = ${divisionValue !== undefined ? (divisionValue ? `'${escapeSql(divisionValue)}'` : 'NULL') : 'division'},
         "updatedAt" = NOW()
       WHERE id = '${escapeSql(existing.userId)}'`
    );
  }

  // Get existing languages data
  let existingLanguages = {};
  if (existing.languages) {
    if (typeof existing.languages === 'string') {
      try {
        existingLanguages = JSON.parse(existing.languages);
      } catch (e) {
        logger.warn(`Failed to parse existing languages JSON: ${e.message}`);
        existingLanguages = {};
      }
    } else if (typeof existing.languages === 'object' && existing.languages !== null) {
      existingLanguages = { ...existing.languages };
    }
  }

  logger.info(`Existing languages data:`, JSON.stringify(existingLanguages, null, 2));

  // Build languages JSON to store additional fields
  // Start with existing data, then overlay with new values
  const languagesData = { ...existingLanguages };
  
  // Handle positionAppliedFor - always update if provided (even if empty array)
  if (positionAppliedFor !== undefined) {
    if (Array.isArray(positionAppliedFor)) {
      // Always save the array, even if empty
      if (positionAppliedFor.length > 0) {
        languagesData.positionAppliedFor = positionAppliedFor;
      } else {
        // Empty array - save as empty array instead of deleting
        languagesData.positionAppliedFor = [];
      }
    } else if (positionAppliedFor !== null && positionAppliedFor !== '') {
      // If it's a string or other value, convert to array
      languagesData.positionAppliedFor = [String(positionAppliedFor)];
    } else {
      // Null or empty string - set as empty array
      languagesData.positionAppliedFor = [];
    }
    logger.info(`PositionAppliedFor processed:`, positionAppliedFor, `-> languagesData.positionAppliedFor:`, languagesData.positionAppliedFor);
  }
  
  // Handle ethnicity - update if provided (even if empty string to clear it)
  if (ethnicity !== undefined) {
    if (ethnicity && ethnicity.trim()) {
      languagesData.ethnicity = ethnicity.trim();
    } else {
      delete languagesData.ethnicity;
    }
  }
  
  // Handle healthStatus - update if provided (even if empty string to clear it)
  if (healthStatus !== undefined) {
    if (healthStatus && healthStatus.trim()) {
      languagesData.healthStatus = healthStatus.trim();
    } else {
      delete languagesData.healthStatus;
    }
  }

  // Handle division list - update if provided
  if (divisionList !== undefined) {
    const divisionsArray = Array.isArray(divisionList)
      ? divisionList.map(item => String(item).trim()).filter(item => item.length > 0)
      : (divisionList ? [String(divisionList).trim()] : []);
    languagesData.divisions = divisionsArray;
  }

  if (yearsOfExperience !== undefined) {
    applyYearsOfExperienceToLanguages(languagesData, yearsOfExperience);
  }

  // Handle drivingLicense - convert string to array if needed
  let drivingLicenseArray = undefined;
  if (candidateData.drivingLicense !== undefined) {
    if (Array.isArray(candidateData.drivingLicense)) {
      drivingLicenseArray = candidateData.drivingLicense;
    } else if (typeof candidateData.drivingLicense === 'string' && candidateData.drivingLicense.trim()) {
      // Try to parse "A & C" or "A,C" format
      drivingLicenseArray = candidateData.drivingLicense
        .split(/[&,]/)
        .map(lic => lic.trim())
        .filter(lic => lic.length > 0);
    } else {
      drivingLicenseArray = [];
    }
  }

  // Encrypt nationalId if provided
  let encryptedNationalId = undefined;
  if (idNumber !== undefined) {
    encryptedNationalId = idNumber ? encrypt(idNumber) : null;
  }

  // Map candidate update - all fields are always sent from frontend, so update them all
  const updateData = {};
  
  // Update all fields that are provided (they're always sent from frontend)
  updateData.placeOfBirth = candidateData.placeOfBirth && String(candidateData.placeOfBirth).trim() ? String(candidateData.placeOfBirth).trim() : null;
  updateData.dateOfBirth = candidateData.dateOfBirth ? new Date(candidateData.dateOfBirth) : null;
  updateData.gender = candidateData.gender && String(candidateData.gender).trim() ? String(candidateData.gender).trim() : null;
  updateData.maritalStatus = candidateData.maritalStatus && String(candidateData.maritalStatus).trim() ? String(candidateData.maritalStatus).trim() : null;
  updateData.currentAddress = candidateData.currentAddress && String(candidateData.currentAddress).trim() ? String(candidateData.currentAddress).trim() : null;
  updateData.permanentAddress = candidateData.permanentAddress && String(candidateData.permanentAddress).trim() ? String(candidateData.permanentAddress).trim() : null;
  updateData.currentJobTitle = candidateData.position && String(candidateData.position).trim() ? String(candidateData.position).trim() : null;
  updateData.skills = Array.isArray(candidateData.skills) ? candidateData.skills : [];
  
  if (drivingLicenseArray !== undefined) {
    updateData.drivingLicense = drivingLicenseArray;
  }
  
  if (height !== undefined && height !== null && height !== '') {
    const heightValue = typeof height === 'string' ? parseInt(height) : height;
    updateData.height = !isNaN(heightValue) && heightValue > 0 ? heightValue : null;
  } else {
    updateData.height = null;
  }
  
  if (weight !== undefined && weight !== null && weight !== '') {
    const weightValue = typeof weight === 'string' ? parseInt(weight) : weight;
    updateData.weight = !isNaN(weightValue) && weightValue > 0 ? weightValue : null;
  } else {
    updateData.weight = null;
  }
  
  updateData.npwpNumber = taxNumber && String(taxNumber).trim() ? String(taxNumber).trim() : null;
  updateData.bpjsHealthNumber = bpjsNumber && String(bpjsNumber).trim() ? String(bpjsNumber).trim() : null;
  updateData.bloodType = bloodType && String(bloodType).trim() ? String(bloodType).trim() : null;
  
  if (encryptedNationalId !== undefined) {
    updateData.nationalId = encryptedNationalId;
  }
  
  // Always update languages if any of these fields are provided
  // Note: positionAppliedFor, ethnicity, and healthStatus are extracted at the top, so check them
  if (positionAppliedFor !== undefined || ethnicity !== undefined || healthStatus !== undefined || divisionList !== undefined || yearsOfExperience !== undefined) {
    // Ensure languagesData has at least the fields we're updating
    // If languagesData is empty object but we have data, make sure we save it
    if (Object.keys(languagesData).length === 0) {
      // If languagesData is empty, initialize it with the fields we're updating
      if (positionAppliedFor !== undefined) {
        languagesData.positionAppliedFor = Array.isArray(positionAppliedFor) ? positionAppliedFor : [];
      }
      if (ethnicity !== undefined) {
        languagesData.ethnicity = ethnicity && String(ethnicity).trim() ? String(ethnicity).trim() : null;
      }
      if (healthStatus !== undefined) {
        languagesData.healthStatus = healthStatus && String(healthStatus).trim() ? String(healthStatus).trim() : null;
      }
      if (divisionList !== undefined) {
        languagesData.divisions = Array.isArray(divisionList)
          ? divisionList.map(item => String(item).trim()).filter(item => item.length > 0)
          : (divisionList ? [String(divisionList).trim()] : []);
      }
    }
    
    // Only save languages if languagesData has at least one key, or if we explicitly want to clear it
    // But if positionAppliedFor is provided (even as empty array), we should save it
    if (
      Object.keys(languagesData).length > 0 ||
      (positionAppliedFor !== undefined && Array.isArray(positionAppliedFor)) ||
      divisionList !== undefined
    ) {
      updateData.languages = languagesData;
      logger.info(`Updating languages with:`, JSON.stringify(languagesData, null, 2));
      logger.info(`Languages updateData.languages will be:`, JSON.stringify(updateData.languages, null, 2));
    } else {
      // If all fields are being cleared, set languages to null
      updateData.languages = null;
      logger.info(`Clearing languages field (all fields are empty/null)`);
    }
  }
  
  logger.info(`Candidate updateData:`, JSON.stringify(updateData, null, 2));
  logger.info(`Division being updated:`, division);
  logger.info(`PositionAppliedFor being updated:`, positionAppliedFor);
  logger.info(`Ethnicity being updated:`, ethnicity);
  logger.info(`HealthStatus being updated:`, healthStatus);

  const updated = await prisma.candidate.update({ 
    where: { id: candidateId }, 
    data: updateData,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          division: true,
        },
      },
    },
  });

  // Decrypt nationalId for response
  if (updated.nationalId) {
    updated.nationalId = decrypt(updated.nationalId);
  }

  enrichCandidateFromLanguages(updated);

  parseFormDataDiri(updated);

  return updated;
}

/**
 * Add education
 */
async function addEducation(candidateId, educationData) {
  const education = await prisma.education.create({
    data: {
      ...educationData,
      candidateId,
    },
  });

  return education;
}

/**
 * Add work experience
 */
async function addWorkExperience(candidateId, experienceData) {
  const experience = await prisma.workExperience.create({
    data: {
      ...experienceData,
      candidateId,
    },
  });

  return experience;
}

/**
 * Add certification
 */
async function addCertification(candidateId, certificationData) {
  const certification = await prisma.certification.create({
    data: {
      ...certificationData,
      candidateId,
    },
  });

  return certification;
}

/**
 * Add reference
 */
async function addReference(candidateId, referenceData) {
  const reference = await prisma.reference.create({
    data: {
      ...referenceData,
      candidateId,
    },
  });

  return reference;
}

/**
 * Search candidates (for TA/HR)
 */
async function searchCandidates(filters, pagination, user = null) {
  const { page = 1, limit = 20 } = pagination;
  const skip = (page - 1) * limit;

  const where = {};

  // Role-based filtering
  if (user) {
    const userRole = user.role;
    const userDivision = user.division;
    const userPt = user.pt;
    const userArea = user.area;
    const userAreaDetail = user.areaDetail;

    if (userRole === 'HIRING_MANAGER') {
      // HIRING_MANAGER: only see candidates where Position.Hiring Manager = Team.First Name
      // Filter candidates that have applications with matching hiring manager
      const hmScope = buildHiringManagerScopeFromUser(user);
      if (hmScope) {
        where.applications = {
          some: {
            fptk: hmScope,
          },
        };
      } else {
        where.id = '00000000-0000-0000-0000-000000000000';
      }
    } else if ((userRole === 'Head of Division' || userRole === 'DEPARTMENT_HEAD') && userDivision) {
      // Head of Division: only see candidates whose profile division matches their division
      where.user = { division: userDivision };
    } else if (userRole === 'HRBP') {
      // HRBP: only see candidates where Position.PT = Team.PT AND Position.Area = Team.Area AND Position.Area Detail = Team.Area Detail
      // All three fields must be present and match
      if (userPt && userArea && userAreaDetail) {
        where.applications = {
          some: {
            fptk: {
              pt: userPt,
              area: userArea,
              areaDetail: userAreaDetail,
            }
          }
        };
      } else {
        // If any field is missing, return no results (HRBP must have all three fields)
        where.id = '00000000-0000-0000-0000-000000000000'; // Non-existent ID to return empty results
      }
    }
    // SUPER_ADMIN, TA_TEAM, and other roles see all candidates (no additional filtering)
  }

  const tokenizedSearch = buildTokenizedSearch(filters, (token) => ([
    { user: { firstName: { contains: token, mode: 'insensitive' } } },
    { user: { lastName: { contains: token, mode: 'insensitive' } } },
    { user: { email: { contains: token, mode: 'insensitive' } } },
  ]));

  if (tokenizedSearch) {
    // If where.OR already exists (from role filtering), combine with AND
    if (where.OR) {
      where.AND = [
        { OR: where.OR },
        tokenizedSearch,
      ];
      delete where.OR;
    } else if (where.applications) {
      where.AND = [
        { applications: where.applications },
        tokenizedSearch,
      ];
      delete where.applications;
    } else if (tokenizedSearch.AND) {
      where.AND = tokenizedSearch.AND;
    } else {
      where.OR = tokenizedSearch.OR;
    }
  }

  if (filters.skills && filters.skills.length > 0) {
    if (where.AND) {
      where.AND.push({ skills: { hasSome: filters.skills } });
    } else {
      where.skills = { hasSome: filters.skills };
    }
  }

  if (filters.minScore) {
    if (where.AND) {
      where.AND.push({ overallScore: { gte: parseFloat(filters.minScore) } });
    } else {
      where.overallScore = { gte: parseFloat(filters.minScore) };
    }
  }

  const activeWhere = withActiveCandidate(where);

  const [candidates, total] = await Promise.all([
    prisma.candidate.findMany({
      where: activeWhere,
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phoneNumber: true,
            division: true,
          },
        },
        documents: {
          orderBy: { uploadedAt: 'desc' },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.candidate.count({ where: activeWhere }),
  ]);

  // Parse languages JSON for each candidate
  const candidatesWithParsedData = candidates.map(candidate => {
    // Decrypt nationalId if present
    if (candidate.nationalId) {
      try {
        candidate.nationalId = decrypt(candidate.nationalId);
      } catch (e) {
        // If decryption fails, leave as is
      }
    }

    // Parse languages JSON to extract additional fields
    if (candidate.languages) {
      if (typeof candidate.languages === 'string') {
        try {
          candidate.languages = JSON.parse(candidate.languages);
        } catch (e) {
          candidate.languages = null;
        }
      }
      if (candidate.languages && typeof candidate.languages === 'object') {
        candidate.positionAppliedFor = candidate.languages.positionAppliedFor || [];
        candidate.ethnicity = candidate.languages.ethnicity || null;
        candidate.healthStatus = candidate.languages.healthStatus || null;
        candidate.yearsOfExperience = parseYearsOfExperience(candidate.languages.yearsOfExperience);

        const divisionsValue = candidate.languages.divisions;
        let divisionsArray = [];
        if (Array.isArray(divisionsValue)) {
          divisionsArray = divisionsValue.map(item => String(item).trim()).filter(item => item.length > 0);
        } else if (divisionsValue !== undefined && divisionsValue !== null) {
          const trimmed = String(divisionsValue).trim();
          divisionsArray = trimmed ? [trimmed] : [];
        }
        candidate.languages.divisions = divisionsArray;
        candidate.divisionList = divisionsArray;
      }
    } else {
      candidate.positionAppliedFor = [];
      candidate.ethnicity = null;
      candidate.healthStatus = null;
      candidate.divisionList = [];
      candidate.yearsOfExperience = null;
    }

    return candidate;
  });

  candidatesWithParsedData.forEach(parseFormDataDiri);

  const forFptkId = filters.forFptkId || null;
  const candidatesWithLock = await enrichCandidatesWithApplicationLock(
    candidatesWithParsedData,
    forFptkId,
    prisma
  );

  // Log a sample candidate to verify data structure
  if (candidatesWithLock.length > 0) {
    const sample = candidatesWithLock[0];
    logger.info(`SEARCH CANDIDATES - Sample candidate data:`, JSON.stringify({
      id: sample.id,
      division: sample.user?.division,
      positionAppliedFor: sample.positionAppliedFor,
      languages: sample.languages,
      ethnicity: sample.ethnicity,
      healthStatus: sample.healthStatus
    }, null, 2));
  }

  return {
    candidates: candidatesWithLock,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Delete education
 */
async function deleteEducation(educationId, candidateId) {
  await prisma.education.deleteMany({
    where: {
      id: educationId,
      candidateId,
    },
  });
}

/**
 * Delete work experience
 */
async function deleteWorkExperience(experienceId, candidateId) {
  await prisma.workExperience.deleteMany({
    where: {
      id: experienceId,
      candidateId,
    },
  });
}

/**
 * Soft-delete a candidate (retain row; hide from all list/detail APIs).
 */
async function softDeleteCandidate(candidateId, deletedByUserId) {
  const existing = await prisma.candidate.findFirst({
    where: { id: candidateId, ...ACTIVE_CANDIDATE_WHERE },
    select: { id: true },
  });

  if (!existing) {
    const error = new Error('Candidate not found');
    error.statusCode = 404;
    throw error;
  }

  await prisma.candidate.update({
    where: { id: candidateId },
    data: {
      isDeleted: true,
      deletedBy: deletedByUserId,
    },
  });

  logger.info(`Candidate soft-deleted: ${candidateId} by user ${deletedByUserId}`);

  return { id: candidateId, isDeleted: true };
}

module.exports = {
  createCandidate,
  getCandidateProfile,
  getCandidateByUserId,
  updateCandidateProfile,
  updateCandidate,
  addEducation,
  addWorkExperience,
  addCertification,
  addReference,
  searchCandidates,
  softDeleteCandidate,
  deleteEducation,
  deleteWorkExperience,
};

