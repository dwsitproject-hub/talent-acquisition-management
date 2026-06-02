const prisma = require('../config/database');
const { $Enums } = require('@prisma/client');
const logger = require('../utils/logger');
const { buildHrbpFptkFilterFromUser } = require('../utils/hrbpScope');
const { buildTokenizedSearch } = require('../utils/search');
const masterOfficeLocationService = require('./masterOfficeLocationService');
const masterDivisionService = require('./masterDivisionService');

const PRISMA_APP_STATUS_STRINGS = new Set(Object.values($Enums.ApplicationStatus));

const UI_STATUS_TO_APP_STATUS_MAP = {
  'applied': 'SUBMITTED',
  'submitted': 'SUBMITTED',
  'under review': 'SCREENING',
  'screening': 'SCREENING',
  'shortlisted': 'SCREENING',
  'cv screening': 'SCREENING',
  'interview scheduled': 'INTERVIEW_SCHEDULED',
  'interviewed': 'INTERVIEW_COMPLETED',
  'interview completed': 'INTERVIEW_COMPLETED',
  'assessment': 'TECHNICAL_TEST',
  'offering creation': 'OFFER_PROPOSED',
  'pending feedback': 'OFFER_APPROVED',
  'document verification': 'DOCUMENT_VERIFICATION',
  'offer proposed': 'OFFER_PROPOSED',
  'offer approved': 'OFFER_APPROVED',
  'offer sent': 'OFFER_SENT',
  'offer accepted': 'OFFER_ACCEPTED',
  'offer declined': 'OFFER_REJECTED',
  'offer rejected': 'OFFER_REJECTED',
  'mcu': 'MEDICAL_CHECKUP_COMPLETED',
  'medical checkup scheduled': 'MEDICAL_CHECKUP_SCHEDULED',
  'medical checkup completed': 'MEDICAL_CHECKUP_COMPLETED',
  'contract sent': 'CONTRACT_SENT',
  'contract signed': 'CONTRACT_SIGNED',
  'on boarding': 'ONBOARDING',
  'onboarding': 'ONBOARDING',
  'hired': 'HIRED',
  'rejected': 'REJECTED',
  'rejected (failed interview / assessment)': 'REJECTED',
  'withdrawn': 'WITHDRAWN',
  'keep in view': 'KEEP_IN_VIEW',
};

const FPTK_RELATION_INCLUDE = {
  creator: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  applications: {
    orderBy: { appliedAt: 'asc' },
    include: {
      candidate: {
        select: {
          id: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
              division: true,
            },
          },
          skills: true,
          languages: true,
          currentJobTitle: true,
          currentCompany: true,
          currentAddress: true,
          formDataDiri: true,
          blacklisted: true,
          blacklistReason: true,
        },
      },
      interviews: {
        include: {
          interviewer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { scheduledAt: 'asc' },
      },
    },
  },
  statusHistory: {
    orderBy: { createdAt: 'asc' },
  },
  _count: {
    select: {
      applications: true,
    },
  },
};

/**
 * Maps FPTK form / Excel labels to Prisma ApplicationStatus.
 * Accepts UI labels ("Keep In View"), enum strings ("KEEP_IN_VIEW"), and underscore variants.
 */
function mapUiStatusToApplicationStatus(status) {
  if (status === undefined || status === null) return 'SUBMITTED';
  const raw = String(status).trim();
  if (!raw) return 'SUBMITTED';
  if (PRISMA_APP_STATUS_STRINGS.has(raw)) {
    return raw;
  }
  const normalized = raw
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (UI_STATUS_TO_APP_STATUS_MAP[normalized]) {
    return UI_STATUS_TO_APP_STATUS_MAP[normalized];
  }
  return 'SUBMITTED';
}

/** Align with applicationService updateApplicationStatus stage rules */
function currentStageForApplicationStatus(status, previousStage) {
  const s = (status && String(status)) || 'SUBMITTED';
  const stage = {
    DRAFT: 1,
    SUBMITTED: 1,
    KEEP_IN_VIEW: 2,
    SCREENING: 2,
    PSYCHOMETRIC_TEST: 3,
    TECHNICAL_TEST: 3,
    INTERVIEW_SCHEDULED: 4,
    INTERVIEW_COMPLETED: 4,
    DOCUMENT_VERIFICATION: 5,
    OFFER_PROPOSED: 6,
    OFFER_APPROVED: 6,
    OFFER_SENT: 6,
    OFFER_ACCEPTED: 6,
    OFFER_REJECTED: 6,
    MEDICAL_CHECKUP_SCHEDULED: 7,
    MEDICAL_CHECKUP_COMPLETED: 7,
    CONTRACT_SENT: 8,
    CONTRACT_SIGNED: 8,
    ONBOARDING: 9,
    HIRED: 9,
  }[s];
  if (stage !== undefined) return stage;
  return previousStage != null && previousStage !== undefined ? previousStage : 1;
}

function normalizeAppliedCandidates(appliedCandidatesInput) {
  if (!appliedCandidatesInput) return [];
  const map = new Map();

  const makeKey = (payload = {}) => {
    const candidateId = payload.candidateId || payload.id || null;
    const email = (payload.email || '').toString().trim().toLowerCase();
    if (candidateId) return `id:${candidateId}`;
    if (email) return `email:${email}`;
    return null;
  };

  const pushCandidate = (payload = {}) => {
    const key = makeKey(payload);
    if (!key) return;
    const entry = {
      candidateId: payload.candidateId || payload.id || null,
      email: payload.email ? payload.email.toString().trim().toLowerCase() : null,
      fullName: payload.fullName || payload.name || null,
      status: payload.status || payload.backendStatus,
      appliedAt: payload.appliedAt || payload.appliedDate || payload.appliedOn,
      source: payload.source,
      interviews: payload.interviews || [], // Preserve interview data
      rejectedDate: payload.rejectedDate || payload.rejectedAt || null,
      withdrawDate: payload.withdrawDate || payload.withdrawnDate || payload.withdrawnAt || null,
      rejectionReason: payload.rejectionReason || payload.withdrawReason || null,
      blacklisted: payload.blacklisted || false,
      blacklistReason: payload.blacklistReason || null,
    };
    if (Object.prototype.hasOwnProperty.call(payload, 'joinDate')) {
      entry.joinDate = payload.joinDate || null;
    } else if (Object.prototype.hasOwnProperty.call(payload, 'join_date')) {
      entry.joinDate = payload.join_date || null;
    }
    map.set(key, entry);
  };

  if (Array.isArray(appliedCandidatesInput)) {
    appliedCandidatesInput.forEach((item) => {
      if (!item) return;
      if (typeof item === 'string') {
        pushCandidate({ candidateId: item });
      } else if (typeof item === 'object') {
        pushCandidate(item);
      }
    });
  } else if (typeof appliedCandidatesInput === 'string') {
    pushCandidate({ candidateId: appliedCandidatesInput });
  }

  return Array.from(map.values());
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function buildHiringManagerWhereFromUser(user = null) {
  if (!user) return null;

  const firstName = String(user.firstName || '').trim();
  const lastName = String(user.lastName || '').trim();
  const email = String(user.email || '').trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  const candidates = [firstName, fullName, email]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  if (candidates.length === 0) return null;

  const uniqueCandidates = Array.from(new Set(candidates));
  return {
    OR: uniqueCandidates.map((value) => ({
      hiringManager: { equals: value, mode: 'insensitive' },
    })),
  };
}

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function normField(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const ALLOWED_STATUS_FKTK = new Set(['pending', 'received', '']);
const ALLOWED_PRIORITY = new Set(['p0', 'p1', 'p2', '']);
const ALLOWED_CRITERIA = new Set(['staff', 'non staff']);
const ALLOWED_ADD_REP = new Set(['additional', 'replacement']);
const ALLOWED_CURRENT_STATUS = new Set([
  'open',
  'pending fktk',
  're-open',
  'cancel',
  'internal movement',
  'close',
]);
const ALLOWED_EMP_CANON = new Set(['contract', 'internship', 'full time employee']);
const EMP_LEGACY = {
  kontrak: 'Contract',
  contract: 'Contract',
  probation: 'Full Time Employee',
  'full-time': 'Full Time Employee',
  fulltime: 'Full Time Employee',
  'full time': 'Full Time Employee',
  'part-time': 'Contract',
  parttime: 'Contract',
  internship: 'Internship',
};

function normalizeEmploymentForApi(raw) {
  const n = normField(raw);
  if (!n) return null;
  if (ALLOWED_EMP_CANON.has(n)) {
    if (n === 'contract') return 'Contract';
    if (n === 'internship') return 'Internship';
    if (n === 'full time employee') return 'Full Time Employee';
  }
  return EMP_LEGACY[n] || null;
}

/** Match UI labels, Prisma enums, and underscore / hyphen variants (same as mapUiStatusToApplicationStatus). */
function normAllowedAppliedStatusValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalized allowed applied-candidate status labels (aligned with frontend template). */
const ALLOWED_APPLIED_STATUS = new Set(
  [
    'Applied',
    'Under Review',
    'Shortlisted',
    'Interview Scheduled',
    'Interviewed',
    'Assessment',
    'Offering Creation',
    'Pending Feedback',
    'Document Verification',
    'Offer Sent',
    'Offer Accepted',
    'Offer Rejected',
    'MCU',
    'Medical Checkup Scheduled',
    'Medical Checkup Completed',
    'Contract Sent',
    'Contract Signed',
    'On Boarding',
    'Hired',
    'Rejected (Failed Interview / Assessment)',
    'Withdrawn',
    'Keep In View',
  ].map((s) => normAllowedAppliedStatusValue(s))
);

async function validateFptkFormFields(payload) {
  const pt = (payload.pt || '').toString().trim();
  if (!pt) {
    throw httpError(400, 'PT is required');
  }

  const locations = await masterOfficeLocationService.getAllOfficeLocations({});
  const ptSet = new Set(locations.map((l) => (l.pt || '').toString().trim()).filter(Boolean));
  if (!ptSet.has(pt)) {
    throw httpError(400, `PT "${pt}" is not registered in Master Office Location`);
  }

  const sf = (payload.statusFktk || '').toString().trim();
  if (sf && !ALLOWED_STATUS_FKTK.has(normField(sf))) {
    throw httpError(400, `Invalid Status FKTK: "${payload.statusFktk}". Use Pending or Received.`);
  }

  const emp = (payload.employmentType || '').toString().trim();
  if (!emp) {
    throw httpError(400, 'Employment Type is required');
  }
  if (!normalizeEmploymentForApi(emp)) {
    throw httpError(
      400,
      `Invalid Employment Type: "${payload.employmentType}". Use Contract, Internship, or Full Time Employee.`
    );
  }

  const pr = (payload.priority || payload.urgentNormal || '').toString().trim();
  if (pr && !ALLOWED_PRIORITY.has(normField(pr))) {
    throw httpError(400, `Invalid Priority: "${pr}". Use P0, P1, or P2.`);
  }

  const cr = (payload.criteria || '').toString().trim();
  if (!cr) {
    throw httpError(400, 'Criteria is required');
  }
  if (!ALLOWED_CRITERIA.has(normField(cr))) {
    throw httpError(400, `Invalid Criteria: "${payload.criteria}". Use Staff or Non Staff.`);
  }

  const ar = (payload.additionalOrReplacement || '').toString().trim();
  if (!ar) {
    throw httpError(400, 'Additional or Replacement is required');
  }
  if (!ALLOWED_ADD_REP.has(normField(ar))) {
    throw httpError(400, `Invalid Additional or Replacement: "${payload.additionalOrReplacement}". Use Additional or Replacement.`);
  }

  const cs = (payload.currentStatus || '').toString().trim();
  if (cs && !ALLOWED_CURRENT_STATUS.has(normField(cs))) {
    throw httpError(
      400,
      `Invalid Current Status: "${payload.currentStatus}". Use values from the Position form (Open, Pending FKTK, …).`
    );
  }

  const divisions = await masterDivisionService.getAllDivisions({});
  const divName = (payload.division || '').toString().trim();
  if (!divName) {
    throw httpError(400, 'Division is required');
  }
  {
    const hasDiv = divisions.some((d) => normField(d.divisionName) === normField(divName));
    if (!hasDiv) {
      throw httpError(400, `Division "${divName}" is not found in Master Division`);
    }
  }

  const secName = (payload.section || '').toString().trim();
  if (!secName) {
    throw httpError(400, 'Section is required');
  }
  if (divName && secName) {
    const ok = divisions.some(
      (d) =>
        normField(d.divisionName) === normField(divName) &&
        normField(d.sectionName) === normField(secName)
    );
    if (!ok) {
      throw httpError(400, `Section "${secName}" is not valid for Division "${divName}"`);
    }
  }

  const area = (payload.area || '').toString().trim();
  const areaDetail = (payload.areaDetail || '').toString().trim();
  if (!area) {
    throw httpError(400, 'Area is required');
  }
  if (!areaDetail) {
    throw httpError(400, 'Area Detail is required');
  }
  const tripleOk = locations.some(
    (l) =>
      (l.pt || '').toString().trim() === pt &&
      normField(l.area) === normField(area) &&
      normField((l.areaDetail || '').toString()) === normField(areaDetail)
  );
  if (!tripleOk) {
    throw httpError(
      400,
      `Area / Area Detail "${area}" / "${areaDetail}" is not valid for PT "${pt}" in Master Office Location`
    );
  }

  const applied = payload.appliedCandidates;
  if (applied && Array.isArray(applied)) {
    applied.forEach((c, idx) => {
      const st = (c && c.status ? String(c.status) : '').trim();
      if (st) {
        const key = normAllowedAppliedStatusValue(st);
        const allowedByPrisma = PRISMA_APP_STATUS_STRINGS.has(st);
        if (!allowedByPrisma && !ALLOWED_APPLIED_STATUS.has(key)) {
        throw httpError(
          400,
          `Invalid Applied Candidate ${idx + 1} Status: "${st}". Use a status from the Position form list.`
        );
        }
      }
    });
  }
}

async function resolveCandidateIdTx(tx, { candidateId, email, fullName }) {
  if (candidateId) return candidateId;
  const normalizedEmail = (email || '').toString().trim().toLowerCase();
  if (!normalizedEmail) return null;

  const candidate = await tx.candidate.findFirst({
    where: { user: { email: normalizedEmail }, isDeleted: false },
    select: {
      id: true,
      user: { select: { firstName: true, lastName: true, email: true } },
      formDataDiri: true,
      languages: true,
    },
  });

  if (!candidate) return null;

  // Validate name match when provided (defensive; allows extra spaces/case differences)
  if (fullName) {
    const userName = `${candidate.user?.firstName || ''} ${candidate.user?.lastName || ''}`.trim();
    let formName = '';
    try {
      const form = typeof candidate.formDataDiri === 'string' ? JSON.parse(candidate.formDataDiri) : candidate.formDataDiri;
      formName = form?.fullName || '';
    } catch (_) {
      formName = '';
    }

    const incoming = normalizeName(fullName);
    const userNorm = normalizeName(userName);
    const formNorm = normalizeName(formName);
    if (incoming && incoming !== userNorm && (!formNorm || incoming !== formNorm)) {
      return { error: `Full Name mismatch for email ${normalizedEmail} (got "${fullName}", expected "${userName || formName || normalizedEmail}")` };
    }
  }

  return candidate.id;
}

async function ensureCandidatePositionAppliedForTx(tx, candidateId, fptkId, positionTitle) {
  if (!candidateId) return;
  if (!fptkId && !positionTitle) return;
  const candidate = await tx.candidate.findUnique({
    where: { id: candidateId },
    select: { id: true, languages: true },
  });
  if (!candidate) return;

  let languages = {};
  if (candidate.languages) {
    if (typeof candidate.languages === 'string') {
      try {
        languages = JSON.parse(candidate.languages);
      } catch (_) {
        languages = {};
      }
    } else if (typeof candidate.languages === 'object') {
      languages = { ...(candidate.languages || {}) };
    }
  }

  const existing = Array.isArray(languages.positionAppliedFor)
    ? languages.positionAppliedFor
    : languages.positionAppliedFor
      ? [String(languages.positionAppliedFor)]
      : [];

  const normalizedExisting = new Set(
    existing
      .map((v) => String(v || '').trim())
      .filter(Boolean)
      // Clean up legacy values that are actually statuses
      .filter((v) => v.toLowerCase() !== 'applied' && v.toLowerCase() !== 'under review' && v.toLowerCase() !== 'shortlisted')
  );
  if (positionTitle) {
    normalizedExisting.add(String(positionTitle).trim());
    languages.positionAppliedFor = Array.from(normalizedExisting);
  }

  if (fptkId) {
    const existingFptkIds = Array.isArray(languages.positionAppliedFptkIds)
      ? languages.positionAppliedFptkIds
      : languages.positionAppliedFptkIds
        ? [String(languages.positionAppliedFptkIds)]
        : [];
    const fptkIdSet = new Set(
      existingFptkIds.map((v) => String(v || '').trim()).filter(Boolean)
    );
    fptkIdSet.add(String(fptkId).trim());
    languages.positionAppliedFptkIds = Array.from(fptkIdSet);
  }

  await tx.candidate.update({
    where: { id: candidateId },
    data: { languages },
  });
}

async function syncFptkApplicationsTx(tx, fptkId, appliedCandidates, options = {}) {
  if (!Array.isArray(appliedCandidates)) {
    return;
  }

  // Resolve the actor's display name once for all history entries in this sync
  let actorName = null;
  if (options.userId) {
    const actor = await tx.user.findUnique({
      where: { id: options.userId },
      select: { firstName: true, lastName: true },
    });
    if (actor) {
      actorName = [actor.firstName, actor.lastName].filter(Boolean).join(' ').trim() || null;
    }
  }

  // Debug: Log received applied candidates to check interview data
  logger.info(`syncFptkApplicationsTx: Processing ${appliedCandidates.length} candidates for FPTK ${fptkId}`);
  appliedCandidates.forEach((candidate, index) => {
    if (candidate.interviews && candidate.interviews.length > 0) {
      logger.info(`Candidate ${index}: ${candidate.id || candidate.candidateId} has ${candidate.interviews.length} interviews`);
    }
  });

  const normalized = normalizeAppliedCandidates(appliedCandidates);

  const fptk = await tx.fPTK.findUnique({
    where: { id: fptkId },
    select: { positionTitle: true, position: true },
  });
  const positionTitle = (fptk?.positionTitle || fptk?.position || '').toString().trim();

  if (normalized.length === 0) {
    await tx.application.deleteMany({
      where: { fptkId },
    });
    return;
  }

  const existingApplications = await tx.application.findMany({
    where: { fptkId },
  });

  const existingByCandidate = new Map(existingApplications.map((app) => [app.candidateId, app]));
  const incomingIds = new Set(normalized.map((item) => item.candidateId));

  const toDelete = existingApplications
    .filter((app) => !incomingIds.has(app.candidateId))
    .map((app) => app.id);

  if (toDelete.length > 0) {
    await tx.application.deleteMany({
      where: { id: { in: toDelete } },
    });
  }

  for (const item of normalized) {
    let candidateId = item.candidateId;
    if (!candidateId) {
      const resolved = await resolveCandidateIdTx(tx, {
        candidateId: item.candidateId,
        email: item.email,
        fullName: item.fullName,
      });
      if (resolved && typeof resolved === 'object' && resolved.error) {
        throw httpError(400, resolved.error);
      }
      candidateId = resolved;
    }

    if (!candidateId) {
      const emailRaw = item.email;
      const emailLabel =
        typeof emailRaw === 'string'
          ? emailRaw
          : emailRaw && typeof emailRaw === 'object'
            ? JSON.stringify(emailRaw)
            : String(emailRaw || '');
      throw httpError(400, `Candidate not found for email ${emailLabel || '(missing email)'}`);
    }

    const existing = existingByCandidate.get(candidateId);
    const status = mapUiStatusToApplicationStatus(item.status);
    const currentStage = currentStageForApplicationStatus(
      status,
      existing && existing.currentStage != null ? existing.currentStage : 1
    );
    const appliedAt = item.appliedAt ? new Date(item.appliedAt) : (existing ? existing.appliedAt : new Date());
    const source = item.source || existing?.source || 'SUGGESTED';
    let rejectedAtValue = null;
    let withdrawnAtValue = null;

    if (status === 'REJECTED') {
      rejectedAtValue = item.rejectedDate ? new Date(item.rejectedDate) : new Date();
      withdrawnAtValue = null;
    } else if (status === 'WITHDRAWN') {
      withdrawnAtValue = item.withdrawDate ? new Date(item.withdrawDate) : new Date();
      rejectedAtValue = null;
    }

    let applicationId;
    const joinDateData = {};
    if (Object.prototype.hasOwnProperty.call(item, 'joinDate')) {
      joinDateData.joinDate = item.joinDate ? new Date(item.joinDate) : null;
    }

    if (existing) {
      await tx.application.update({
        where: { id: existing.id },
        data: {
          status,
          currentStage,
          appliedAt,
          source,
          rejectedAt: typeof rejectedAtValue !== 'undefined' ? rejectedAtValue : undefined,
          withdrawnAt: typeof withdrawnAtValue !== 'undefined' ? withdrawnAtValue : undefined,
          ...(item.rejectionReason !== undefined ? { rejectionReason: item.rejectionReason || null } : {}),
          ...joinDateData,
        },
      });
      applicationId = existing.id;

      // Record status history only when the status actually changed
      if (existing.status !== status) {
        await tx.applicationStatusHistory.create({
          data: {
            applicationId: existing.id,
            fromStatus: existing.status,
            toStatus: status,
            changedBy: options.userId || null,
            changedByName: actorName,
            reason: 'Status updated via position management',
          },
        });
      }
    } else {
      try {
        const newApplication = await tx.application.create({
          data: {
            candidateId,
            fptkId,
            status,
            currentStage,
            appliedAt,
            source,
            appliedByUserId: options.userId || null,
            rejectedAt: typeof rejectedAtValue !== 'undefined' ? rejectedAtValue : undefined,
            withdrawnAt: typeof withdrawnAtValue !== 'undefined' ? withdrawnAtValue : undefined,
            ...(item.rejectionReason ? { rejectionReason: item.rejectionReason } : {}),
            ...joinDateData,
          },
        });
        applicationId = newApplication.id;

        // Record the initial submission in status history
        await tx.applicationStatusHistory.create({
          data: {
            applicationId: newApplication.id,
            fromStatus: null,
            toStatus: status,
            changedBy: options.userId || null,
            changedByName: actorName,
            reason: 'Candidate added to position',
          },
        });
      } catch (error) {
        logger.warn(`Failed to create application for candidate ${candidateId} on FPTK ${fptkId}: ${error.message}`);
        continue; // Skip to next candidate if application creation failed
      }
    }

    // Ensure candidate "Position Applied For" is updated (languages.positionAppliedFor)
    if (fptkId) {
      await ensureCandidatePositionAppliedForTx(tx, candidateId, fptkId, positionTitle);
    }

    // Update blacklist status on candidate if explicitly provided
    if (item.blacklisted === true || item.blacklisted === false) {
      await tx.candidate.update({
        where: { id: candidateId },
        data: {
          blacklisted: item.blacklisted,
          ...(item.blacklisted && item.blacklistReason ? { blacklistReason: item.blacklistReason } : {}),
          ...(!item.blacklisted ? { blacklistReason: null } : {}),
        },
      });
    }

    // Handle interview data if provided
    if (applicationId && item.interviews && Array.isArray(item.interviews)) {
      logger.info(`Processing ${item.interviews.length} interviews for application ${applicationId}`);
      
      // Delete existing interviews for this application
      await tx.interview.deleteMany({
        where: { applicationId },
      });

      // Create new interviews from the provided data
      for (const interviewData of item.interviews) {
        logger.info(`Processing interview data:`, JSON.stringify(interviewData));
        // Skip empty interviews (all fields empty)
        if (!interviewData.interviewer && !interviewData.date && !interviewData.time && !interviewData.results) {
          continue;
        }

        try {
          // Parse date and time if provided
          let scheduledAt = new Date();
          if (interviewData.date) {
            const dateStr = interviewData.date;
            const timeStr = interviewData.time || '00:00';
            const [hours, minutes] = timeStr.split(':').map(Number);
            scheduledAt = new Date(dateStr);
            scheduledAt.setHours(hours || 0, minutes || 0, 0, 0);
          }

          // Determine interview status based on data
          let interviewStatus = 'SCHEDULED';
          if (interviewData.results && interviewData.results.trim()) {
            interviewStatus = 'COMPLETED';
          }

          // Try to find interviewer by name/email if interviewer field is provided
          let interviewerId = null;
          if (interviewData.interviewer && interviewData.interviewer.trim()) {
            // Try to find user by email or name
            const interviewerParts = interviewData.interviewer.trim().split(' ');
            const firstName = interviewerParts[0] || '';
            const lastName = interviewerParts.slice(1).join(' ') || '';
            
            const interviewer = await tx.user.findFirst({
              where: {
                OR: [
                  { email: { contains: interviewData.interviewer.trim(), mode: 'insensitive' } },
                  ...(firstName ? [{ firstName: { contains: firstName, mode: 'insensitive' } }] : []),
                  ...(lastName ? [{ lastName: { contains: lastName, mode: 'insensitive' } }] : []),
                ],
              },
              select: { id: true },
            });
            if (interviewer) {
              interviewerId = interviewer.id;
            }
          }

          await tx.interview.create({
            data: {
              applicationId,
              candidateId,
              interviewType: 'HR_INTERVIEW', // Default type, can be enhanced later
              status: interviewStatus,
              round: 1, // Default to round 1, can be enhanced later
              scheduledAt,
              duration: 60, // Default 60 minutes, can be enhanced later
              notes: interviewData.results || null,
              completedAt: interviewStatus === 'COMPLETED' ? new Date() : null,
              interviewerId,
              interviewerName: interviewData.interviewer && interviewData.interviewer.trim() ? interviewData.interviewer.trim() : null, // Store interviewer name even if no matching user found
            },
          });
        } catch (error) {
          logger.warn(`Failed to create interview for application ${applicationId}: ${error.message}`);
        }
      }
    }
  }

  await ensureFptkCloseIfAnyOnBoardingTx(tx, fptkId);
}

async function ensureFptkCloseIfAnyOnBoardingTx(tx, fptkId) {
  const onboardingCount = await tx.application.count({
    where: { fptkId, status: 'ONBOARDING' },
  });
  if (onboardingCount > 0) {
    const current = await tx.fPTK.findUnique({
      where: { id: fptkId },
      select: { currentStatus: true, closedAt: true },
    });
    await tx.fPTK.update({
      where: { id: fptkId },
      data: {
        currentStatus: 'Close',
        closedAt: current?.closedAt || new Date(),
      },
    });
  }
}

async function getFptkWithRelations(fptkId) {
  return prisma.fPTK.findUnique({
    where: { id: fptkId },
    include: FPTK_RELATION_INCLUDE,
  });
}

/**
 * Create FPTK
 */
async function createFPTK(data, creatorId) {
  const statusFktkNormalized = (data.statusFktk || '').trim().toLowerCase();
  let fptkNumber = (data.fptkNumber || data.noFktk || '').toString().trim();

  if (statusFktkNormalized === 'received' && !fptkNumber) {
    throw new Error('FPTK number (noFktk) is required when Status FKTK is Received');
  }

  if (fptkNumber) {
    const existing = await prisma.fPTK.findUnique({
      where: { fptkNumber },
    });

    if (existing) {
      throw new Error('FPTK number already exists');
    }
  } else {
    fptkNumber = null;
  }

  await validateFptkFormFields(data);
  const empCanon = normalizeEmploymentForApi((data.employmentType || '').toString());
  if (empCanon) {
    data.employmentType = empCanon;
  }

  const appliedCandidatesProvided = data.appliedCandidates !== undefined || data.appliedCandidateIds !== undefined;
  const normalizedAppliedCandidates = appliedCandidatesProvided
    ? normalizeAppliedCandidates(data.appliedCandidates ?? data.appliedCandidateIds)
    : [];

  // Handle file upload if present (from express-fileupload middleware)
  let fptkFilePath = null;
  let fptkFileName = null;
  let fptkReceiveDate = null;
  
  // Handle file from req.files (express-fileupload) or data.fptkFile (if passed directly)
  const file = data.fptkFile || (data.files && data.files.fptkFile);
  if (file && file.name) {
    const path = require('path');
    const fs = require('fs');
    const uploadDir = path.join(__dirname, '../../uploads/fptk');
    
    // Ensure upload directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    // Generate unique filename
    const fileExt = path.extname(file.name);
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const fullPath = path.join(uploadDir, fileName);
    fptkFileName = file.name;
    
    // Save file asynchronously (express-fileupload provides .mv() method)
    if (file.mv) {
      try {
        await new Promise((resolve, reject) => {
          file.mv(fullPath, (err) => {
            if (err) reject(err);
            else resolve(true);
          });
        });
        fptkFilePath = `/uploads/fptk/${fileName}`;
      } catch (err) {
        logger.error(`Failed to save FPTK file: ${err.message}`);
      }
    } else if (file.data) {
      // Handle Buffer directly
      try {
        fs.writeFileSync(fullPath, file.data);
        fptkFilePath = `/uploads/fptk/${fileName}`;
      } catch (err) {
        logger.error(`Failed to save FPTK file: ${err.message}`);
      }
    }
  }
  
  // Handle fptkReceiveDate
  if (data.fptkReceiveDate) {
    try {
      fptkReceiveDate = new Date(data.fptkReceiveDate);
      if (isNaN(fptkReceiveDate.getTime())) {
        fptkReceiveDate = new Date();
      }
    } catch (e) {
      fptkReceiveDate = new Date();
    }
  }

  // Map frontend fields to database fields
  const fptkData = {
    fptkNumber,
    pt: data.pt,
    noFktk: data.noFktk ? data.noFktk.trim() : null,
    statusFktk: data.statusFktk,
    division: data.division,
    section: data.section,
    hiringManager: data.hiringManager,
    position: data.position || data.positionTitle,
    positionTitle: data.positionTitle || data.position,
    department: data.department || data.division,
    location: data.location || data.area,
    employmentType: data.employmentType,
    typeGrade: data.typeGrade,
    grade2: data.grade2,
    level: data.level || data.typeGrade,
    priority: data.priority || data.urgentNormal || null,
    priorityByMonthYear: data.priorityByMonthYear || null,
    isPriority: data.priority === 'P0' || data.urgentNormal === 'P0',
    jobSpecification: data.jobSpecification || data.description,
    criteria: data.criteria,
    area: data.area,
    areaDetail: data.areaDetail,
    additionalOrReplacement: data.additionalOrReplacement,
    replacementName: data.replacementName,
    resignReason: data.resignReason,
    totalRequest: data.totalRequest ? parseInt(data.totalRequest) : 1,
    // Use currentStatus from data, don't fall back to statusFktk
    // If not provided, default to 'Raise FPTK'
    currentStatus: data.currentStatus || 'Raise FPTK',
    closedAt:
      ((data.currentStatus || '').toString().trim().toLowerCase() === 'close')
        ? new Date()
        : null,
    requestDate: (data.requestDate && data.requestDate.toString().trim() !== '') 
      ? (() => {
          try {
            const date = new Date(data.requestDate);
            // Check if date is valid
            if (isNaN(date.getTime())) {
              return new Date(); // Use today's date if invalid
            }
            return date;
          } catch (e) {
            return new Date(); // Use today's date if error
          }
        })()
      : new Date(), // Use today's date if empty
    // FPTK File Information
    fptkFilePath: fptkFilePath,
    fptkFileName: fptkFileName,
    fptkReceiveDate: fptkReceiveDate,
    // Legacy fields
    numberOfPositions: data.numberOfPositions ? parseInt(data.numberOfPositions) : (data.totalRequest ? parseInt(data.totalRequest) : 1),
    filledPositions: 0,
    minEducation: data.minEducation,
    minExperience: data.minExperience,
    requiredSkills: data.requiredSkills || data.skills || [],
    jobDescription: data.jobDescription || data.jobSpecification || data.description,
    responsibilities: data.responsibilities,
    qualifications: data.qualifications || data.criteria,
    salaryRangeMin: data.salaryRangeMin,
    salaryRangeMax: data.salaryRangeMax,
    benefits: data.benefits,
    requestedBy: data.requestedBy || data.hiringManager,
    status: data.status || 'DRAFT',
    // Don't set createdBy here - we'll use connect for the relation
    remark: data.remark,
  };

  // Remove undefined fields
  Object.keys(fptkData).forEach(key => {
    if (fptkData[key] === undefined) {
      delete fptkData[key];
    }
  });

  if (!creatorId) {
    throw new Error('Creator ID is required');
  }

  // Verify creator exists
  const creator = await prisma.user.findUnique({
    where: { id: creatorId },
    select: { id: true },
  });

  if (!creator) {
    throw new Error('Creator user not found');
  }

  const createdFptk = await prisma.$transaction(async (tx) => {
    // Use connect for the creator relation - Prisma will automatically set createdBy
    // Make sure createdBy is not in fptkData (we removed it earlier, but just in case)
    const createData = { ...fptkData };
    // Remove createdBy if it exists (it shouldn't, but just in case)
    delete createData.createdBy;
    // Add the creator relation
    createData.creator = {
      connect: { id: creatorId }
    };
    
    const fptk = await tx.fPTK.create({
      data: createData,
    });

    // Create initial status history entry
    await tx.fPTKStatusHistory.create({
      data: {
        fptkId: fptk.id,
        fromStatus: null,
        toStatus: fptk.currentStatus || 'Raise FPTK',
        changedBy: creatorId,
        reason: 'FPTK created',
        startDate: new Date(),
      },
    });

    if (appliedCandidatesProvided) {
      await syncFptkApplicationsTx(tx, fptk.id, normalizedAppliedCandidates, { userId: creatorId });
    }

    return fptk;
  });

  logger.info(`FPTK created: ${createdFptk.fptkNumber || createdFptk.id} by user ${creatorId}`);

  const enriched = await getFptkWithRelations(createdFptk.id);
  return enriched || createdFptk;
}

/**
 * Get FPTK by ID
 */
async function getFPTKById(fptkId) {
  const fptk = await getFptkWithRelations(fptkId);

  if (!fptk) {
    throw new Error('FPTK not found');
  }

  return fptk;
}

/**
 * Shared WHERE clause for internal FPTK list + aggregates (same access rules as list).
 */
function buildInternalFptkListWhere(filters = {}, user = null) {
  const where = {};

  if (user) {
    const userRole = user.role;
    const userDivision = user.division;
    if (userRole === 'HIRING_MANAGER') {
      const hmWhere = buildHiringManagerWhereFromUser(user);
      if (hmWhere) {
        Object.assign(where, hmWhere);
      } else {
        // Hiring manager without an identifier should see nothing.
        where.id = '00000000-0000-0000-0000-000000000000';
      }
    } else if ((userRole === 'Head of Division' || userRole === 'DEPARTMENT_HEAD') && userDivision) {
      where.division = userDivision;
    } else if (userRole === 'HRBP') {
      const hrbp = buildHrbpFptkFilterFromUser(user);
      if (hrbp) {
        Object.assign(where, hrbp);
      } else {
        where.id = '00000000-0000-0000-0000-000000000000';
      }
    }
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.department) {
    where.department = filters.department;
  }

  if (filters.isPublished !== undefined) {
    where.isPublished = filters.isPublished === 'true';
  }

  const tokenizedSearch = buildTokenizedSearch(filters, (token) => ([
    { fptkNumber: { contains: token, mode: 'insensitive' } },
    { positionTitle: { contains: token, mode: 'insensitive' } },
    { position: { contains: token, mode: 'insensitive' } },
    { department: { contains: token, mode: 'insensitive' } },
    { division: { contains: token, mode: 'insensitive' } },
  ]));
  if (tokenizedSearch) {
    if (where.OR) {
      where.AND = [{ OR: where.OR }, tokenizedSearch];
      delete where.OR;
    } else if (tokenizedSearch.AND) {
      where.AND = tokenizedSearch.AND;
    } else {
      where.OR = tokenizedSearch.OR;
    }
  }

  if (filters.division) {
    where.division = filters.division;
  }

  if (filters.priority) {
    where.priority = filters.priority;
  }

  const applyCsvInField = (field, raw) => {
    if (raw == null || raw === '') return;
    const parts = String(raw)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) {
      const value = parts.length === 1 ? parts[0] : { in: parts };
      Object.assign(where, { [field]: value });
    }
  };

  applyCsvInField('currentStatus', filters.currentStatus);
  applyCsvInField('pt', filters.pt);
  applyCsvInField('area', filters.area);
  applyCsvInField('areaDetail', filters.areaDetail);

  return where;
}

/**
 * Count FPTKs per currentStatus (for dashboard chips), scoped like the list.
 */
async function getFptkCurrentStatusCounts(filters, user = null) {
  const countFilters = { ...filters };
  delete countFilters.currentStatus;
  const where = buildInternalFptkListWhere(countFilters, user);
  const rows = await prisma.fPTK.groupBy({
    by: ['currentStatus'],
    where,
    _count: { _all: true },
  });
  const counts = {};
  rows.forEach((r) => {
    const key = r.currentStatus == null ? '' : String(r.currentStatus);
    counts[key] = r._count._all;
  });
  return counts;
}

/**
 * Get all FPTKs with filters
 */
async function getAllFPTKs(filters, pagination, user = null) {
  const { page = 1, limit = 20 } = pagination;
  const skip = (page - 1) * limit;

  const where = buildInternalFptkListWhere(filters, user);

  const [fptks, total] = await Promise.all([
    prisma.fPTK.findMany({
      where,
      skip,
      take: limit,
      include: FPTK_RELATION_INCLUDE,
      orderBy: { positionTitle: 'asc' },
    }),
    prisma.fPTK.count({ where }),
  ]);

  return {
    fptks,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
}

function resolveFptkPositionTitle(row) {
  const raw = row.position || row.positionTitle || row.department;
  if (raw && String(raw).trim().length > 0) {
    return String(raw).trim();
  }
  return `Position ${String(row.id || '').slice(0, 8)}`;
}

/**
 * Lightweight FPTK rows for position picker (candidate add/edit).
 */
async function getFptkPositionOptions(filters, pagination, user = null) {
  const { page = 1, limit = 100 } = pagination;
  const skip = (page - 1) * limit;

  const where = buildInternalFptkListWhere(filters, user);

  const [rows, total] = await Promise.all([
    prisma.fPTK.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        fptkNumber: true,
        positionTitle: true,
        position: true,
        department: true,
        division: true,
        currentStatus: true,
        status: true,
      },
      orderBy: { positionTitle: 'asc' },
    }),
    prisma.fPTK.count({ where }),
  ]);

  const data = rows.map((row) => ({
    id: row.id,
    fptkNumber: row.fptkNumber,
    title: resolveFptkPositionTitle(row),
    positionTitle: row.positionTitle,
    position: row.position,
    department: row.department || '',
    division: row.division || '',
    currentStatus: row.currentStatus || row.status || '',
  }));

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
}

async function getSummaryByPosition(user = null) {
  // Reuse the shared WHERE builder — produces identical scoping to getAllFPTKs.
  const fptkWhere = buildInternalFptkListWhere({}, user);

  const fptkSelect = {
    id: true,
    priority: true,
    department: true,
    division: true,
    section: true,
    positionTitle: true,
    position: true,
    currentStatus: true,
    statusFktk: true,
    remark: true,
    location: true,
    area: true,
    areaDetail: true,
    requestDate: true,
    fptkReceiveDate: true,
    closedAt: true,
    createdAt: true,
    updatedAt: true,
  };

  let fptks, grouped, totalGrouped, onboardingApps;

  // Shared select for ONBOARDING candidates (name + join date)
  const onboardingSelect = {
    fptkId: true,
    joinDate: true,
    candidate: {
      select: {
        user: {
          select: { firstName: true, lastName: true },
        },
      },
    },
  };

  const isScopedRole = Object.keys(fptkWhere).length > 0;

  if (!isScopedRole) {
    // Unrestricted roles (SUPER_ADMIN, TA_TEAM, etc.): all queries are
    // independent — run them in parallel to halve round-trip latency.
    [fptks, grouped, totalGrouped, onboardingApps] = await Promise.all([
      prisma.fPTK.findMany({
        where: {},
        select: fptkSelect,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.application.groupBy({
        by: ['fptkId', 'status'],
        _count: { _all: true },
      }),
      // Total applicants per FPTK regardless of current status — used for the
      // cumulative "Applied" count so it never decreases as candidates advance.
      prisma.application.groupBy({
        by: ['fptkId'],
        _count: { _all: true },
      }),
      // ONBOARDING candidates with their expected join date
      prisma.application.findMany({
        where: { status: 'ONBOARDING' },
        select: onboardingSelect,
      }),
    ]);
  } else {
    // Scoped roles (HIRING_MANAGER, Head of Division, HRBP): fetch the
    // allowed FPTK IDs first, then use fptkId IN (...) for the groupBy so
    // the application query uses the composite index instead of a JOIN.
    fptks = await prisma.fPTK.findMany({
      where: fptkWhere,
      select: fptkSelect,
      orderBy: { createdAt: 'desc' },
    });

    const fptkIds = fptks.map((f) => f.id);
    [grouped, totalGrouped, onboardingApps] = fptkIds.length > 0
      ? await Promise.all([
          prisma.application.groupBy({
            by: ['fptkId', 'status'],
            where: { fptkId: { in: fptkIds } },
            _count: { _all: true },
          }),
          prisma.application.groupBy({
            by: ['fptkId'],
            where: { fptkId: { in: fptkIds } },
            _count: { _all: true },
          }),
          prisma.application.findMany({
            where: { status: 'ONBOARDING', fptkId: { in: fptkIds } },
            select: onboardingSelect,
          }),
        ])
      : [[], [], []];
  }

  // Total applicants per FPTK (all statuses combined)
  const totalApplicantsByFptkId = {};
  (totalGrouped || []).forEach((g) => {
    if (!g.fptkId) return;
    totalApplicantsByFptkId[g.fptkId] = g._count?._all || 0;
  });

  // ONBOARDING candidates grouped by fptkId: [{ name, joinDate }]
  const onboardingByFptkId = {};
  (onboardingApps || []).forEach((app) => {
    if (!app.fptkId) return;
    const firstName = app.candidate?.user?.firstName || '';
    const lastName = app.candidate?.user?.lastName || '';
    const name = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';
    if (!onboardingByFptkId[app.fptkId]) onboardingByFptkId[app.fptkId] = [];
    onboardingByFptkId[app.fptkId].push({
      name,
      joinDate: app.joinDate ? app.joinDate.toISOString() : null,
    });
  });

  const countsByFptkId = {};
  const allStatuses = new Set();
  grouped.forEach((g) => {
    if (!g.fptkId) return;
    const status = (g.status || '').toString();
    allStatuses.add(status);
    if (!countsByFptkId[g.fptkId]) countsByFptkId[g.fptkId] = {};
    countsByFptkId[g.fptkId][status] = g._count?._all || 0;
  });

  // Provide unique filter options quickly
  const priorities = new Set();
  const divisions = new Set();
  const locations = new Set();
  fptks.forEach((f) => {
    const p = (f.priority || '').toString().trim();
    if (p) priorities.add(p);
    const d = (f.department || f.division || '').toString().trim();
    if (d) divisions.add(d);
    const l = (f.areaDetail || f.area || f.location || '').toString().trim();
    if (l) locations.add(l);
  });

  return {
    fptks,
    applicationCounts: countsByFptkId,
    totalApplicants: totalApplicantsByFptkId,
    onboardingCandidates: onboardingByFptkId,
    statuses: Array.from(allStatuses),
    priorities: Array.from(priorities),
    divisions: Array.from(divisions),
    locations: Array.from(locations),
  };
}

/**
 * Update FPTK
 */
async function updateFPTK(fptkId, data, updaterId) {
  const current = await prisma.fPTK.findUnique({
    where: { id: fptkId },
  });

  if (!current) {
    throw new Error('FPTK not found');
  }

  await validateFptkFormFields({ ...current, ...data });
  if (data.employmentType !== undefined) {
    const empCanon = normalizeEmploymentForApi((data.employmentType || '').toString());
    if (empCanon) {
      data.employmentType = empCanon;
    }
  }

  const statusFktkNormalized = ((data.statusFktk !== undefined ? data.statusFktk : current.statusFktk) || '')
    .toString()
    .trim()
    .toLowerCase();

  const incomingNumberRaw =
    data.fptkNumber !== undefined
      ? data.fptkNumber
      : data.noFktk !== undefined
        ? data.noFktk
        : undefined;

  const incomingNumber = incomingNumberRaw !== undefined ? incomingNumberRaw.toString().trim() : undefined;

  const effectiveNumber =
    incomingNumber !== undefined && incomingNumber !== ''
      ? incomingNumber
      : (current.fptkNumber || current.noFktk || '').toString().trim();

  if (statusFktkNormalized === 'received' && !effectiveNumber) {
    throw new Error('FPTK number (noFktk) is required when Status FKTK is Received');
  }

  if (incomingNumber !== undefined && incomingNumber !== '') {
    const existing = await prisma.fPTK.findFirst({
      where: {
        fptkNumber: incomingNumber,
        NOT: { id: fptkId },
      },
    });

    if (existing) {
      throw new Error('FPTK number already exists');
    }
  }

  const appliedCandidatesProvided = data.appliedCandidates !== undefined || data.appliedCandidateIds !== undefined;
  const normalizedAppliedCandidates = appliedCandidatesProvided
    ? normalizeAppliedCandidates(data.appliedCandidates ?? data.appliedCandidateIds)
    : [];

  // Map frontend fields to database fields
  const updateData = {};

  // Map all fields similar to create
  if (data.pt !== undefined) updateData.pt = data.pt;
  if (data.noFktk !== undefined || data.fptkNumber !== undefined) {
    const numberValue =
      incomingNumber !== undefined
        ? incomingNumber
        : undefined;

    if (data.noFktk !== undefined) {
      updateData.noFktk = numberValue || null;
    }

    if (data.fptkNumber !== undefined || data.noFktk !== undefined) {
      updateData.fptkNumber = numberValue || null;
    }
  }
  if (data.statusFktk !== undefined) updateData.statusFktk = data.statusFktk;
  if (data.division !== undefined) updateData.division = data.division;
  if (data.section !== undefined) updateData.section = data.section;
  if (data.hiringManager !== undefined) updateData.hiringManager = data.hiringManager;
  if (data.position !== undefined) {
    updateData.position = data.position;
    updateData.positionTitle = data.position;
  }
  if (data.department !== undefined) updateData.department = data.department;
  if (data.location !== undefined) updateData.location = data.location;
  if (data.employmentType !== undefined) updateData.employmentType = data.employmentType;
  if (data.typeGrade !== undefined) updateData.typeGrade = data.typeGrade;
  if (data.grade2 !== undefined) updateData.grade2 = data.grade2;
  if (data.level !== undefined) updateData.level = data.level;
  if (data.priority !== undefined) {
    updateData.priority = data.priority;
    updateData.isPriority = data.priority === 'P0';
  }
  if (data.priorityByMonthYear !== undefined) updateData.priorityByMonthYear = data.priorityByMonthYear;
  if (data.jobSpecification !== undefined) updateData.jobSpecification = data.jobSpecification;
  if (data.criteria !== undefined) updateData.criteria = data.criteria;
  if (data.area !== undefined) updateData.area = data.area;
  if (data.areaDetail !== undefined) updateData.areaDetail = data.areaDetail;
  if (data.additionalOrReplacement !== undefined) updateData.additionalOrReplacement = data.additionalOrReplacement;
  if (data.replacementName !== undefined) updateData.replacementName = data.replacementName;
  if (data.resignReason !== undefined) updateData.resignReason = data.resignReason;
  if (data.totalRequest !== undefined) {
    updateData.totalRequest = parseInt(data.totalRequest);
    updateData.numberOfPositions = parseInt(data.totalRequest);
  }
  if (data.currentStatus !== undefined) {
    updateData.currentStatus = data.currentStatus;
    const nextStatus = String(data.currentStatus || '').trim().toLowerCase();
    const prevStatus = String(current.currentStatus || '').trim().toLowerCase();
    if (nextStatus === 'close' && prevStatus !== 'close') {
      updateData.closedAt = new Date();
    } else if (nextStatus !== 'close' && prevStatus === 'close') {
      updateData.closedAt = null;
    }
  }
  if (data.requestDate !== undefined) updateData.requestDate = new Date(data.requestDate);
  if (data.status !== undefined) updateData.status = data.status;
  if (data.remark !== undefined) updateData.remark = data.remark;
  if (data.requiredSkills !== undefined) updateData.requiredSkills = data.requiredSkills;

  // Handle FPTK file upload if present (from express-fileupload middleware)
  // Only update file fields if a new file is explicitly provided
  const file = data.fptkFile || (data.files && data.files.fptkFile);
  if (file && file.name) {
    const path = require('path');
    const fs = require('fs');
    const uploadDir = path.join(__dirname, '../../uploads/fptk');
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const fileExt = path.extname(file.name);
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const fullPath = path.join(uploadDir, fileName);
    updateData.fptkFileName = file.name;
    
    if (file.mv) {
      try {
        await new Promise((resolve, reject) => {
          file.mv(fullPath, (err) => {
            if (err) reject(err);
            else resolve(true);
          });
        });
        updateData.fptkFilePath = `/uploads/fptk/${fileName}`;
      } catch (err) {
        logger.error(`Failed to save FPTK file: ${err.message}`);
      }
    } else if (file.data) {
      try {
        fs.writeFileSync(fullPath, file.data);
        updateData.fptkFilePath = `/uploads/fptk/${fileName}`;
      } catch (err) {
        logger.error(`Failed to save FPTK file: ${err.message}`);
      }
    }
  }
  // If no new file is provided, preserve existing file fields (don't clear them)
  // Prisma will preserve fields that are not in updateData, so we don't need to do anything here
  
  // Handle fptkReceiveDate - only update if explicitly provided (not undefined/null/empty)
  if (data.fptkReceiveDate !== undefined && data.fptkReceiveDate !== null && data.fptkReceiveDate !== '') {
    try {
      updateData.fptkReceiveDate = new Date(data.fptkReceiveDate);
      if (isNaN(updateData.fptkReceiveDate.getTime())) {
        // Invalid date - don't update, preserve existing
        logger.warn(`Invalid fptkReceiveDate provided: ${data.fptkReceiveDate}`);
      }
    } catch (e) {
      // Error parsing date - don't update, preserve existing
      logger.warn(`Error parsing fptkReceiveDate: ${e.message}`);
    }
  }
  // If fptkReceiveDate is undefined/null/empty, don't update it (preserve existing)

  // Legacy fields
  if (data.minEducation !== undefined) updateData.minEducation = data.minEducation;
  if (data.minExperience !== undefined) updateData.minExperience = data.minExperience;
  if (data.jobDescription !== undefined) updateData.jobDescription = data.jobDescription;
  if (data.responsibilities !== undefined) updateData.responsibilities = data.responsibilities;
  if (data.qualifications !== undefined) updateData.qualifications = data.qualifications;

  const updatedFptk = await prisma.$transaction(async (tx) => {
    // Get current FPTK to check for status change
    const currentFptk = await tx.fPTK.findUnique({
      where: { id: fptkId },
      select: { currentStatus: true },
    });

    const fptk = await tx.fPTK.update({
      where: { id: fptkId },
      data: updateData,
    });

    // Track status change if currentStatus changed
    if (data.currentStatus !== undefined && data.currentStatus !== currentFptk?.currentStatus) {
      // End the previous status history entry
      const previousStatus = await tx.fPTKStatusHistory.findFirst({
        where: {
          fptkId: fptkId,
          toStatus: currentFptk?.currentStatus || 'Raise FPTK',
          endDate: null,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (previousStatus) {
        await tx.fPTKStatusHistory.update({
          where: { id: previousStatus.id },
          data: { endDate: new Date() },
        });
      }

      // Create new status history entry
      await tx.fPTKStatusHistory.create({
        data: {
          fptkId: fptkId,
          fromStatus: currentFptk?.currentStatus || null,
          toStatus: data.currentStatus,
          changedBy: updaterId,
          reason: data.statusChangeReason || 'Status updated',
          startDate: new Date(),
        },
      });
    }

    if (appliedCandidatesProvided) {
      await syncFptkApplicationsTx(tx, fptkId, normalizedAppliedCandidates, { userId: updaterId });
    }

    return fptk;
  });

  logger.info(`FPTK updated: ${fptkId}`);

  const enriched = await getFptkWithRelations(updatedFptk.id);
  return enriched || updatedFptk;
}

/**
 * Publish FPTK (make visible to candidates)
 */
async function publishFPTK(fptkId) {
  const fptk = await prisma.fPTK.update({
    where: { id: fptkId },
    data: {
      isPublished: true,
      publishedAt: new Date(),
      status: 'OPEN',
    },
  });

  logger.info(`FPTK published: ${fptkId}`);

  return fptk;
}

/**
 * Unpublish FPTK
 */
async function unpublishFPTK(fptkId) {
  const fptk = await prisma.fPTK.update({
    where: { id: fptkId },
    data: {
      isPublished: false,
    },
  });

  logger.info(`FPTK unpublished: ${fptkId}`);

  return fptk;
}

/**
 * Get published FPTKs (for candidate portal)
 */
async function getPublishedFPTKs(filters, pagination) {
  const { page = 1, limit = 20 } = pagination;
  const skip = (page - 1) * limit;

  const where = {
    isPublished: true,
    status: 'OPEN',
  };

  if (filters.department) {
    where.department = filters.department;
  }

  if (filters.location) {
    where.location = { contains: filters.location, mode: 'insensitive' };
  }

  if (filters.employmentType) {
    where.employmentType = filters.employmentType;
  }

  const tokenizedSearch = buildTokenizedSearch(filters, (token) => ([
    { positionTitle: { contains: token, mode: 'insensitive' } },
    { jobDescription: { contains: token, mode: 'insensitive' } },
  ]));
  if (tokenizedSearch) {
    if (tokenizedSearch.AND) {
      where.AND = tokenizedSearch.AND;
    } else {
      where.OR = tokenizedSearch.OR;
    }
  }

  const [fptks, total] = await Promise.all([
    prisma.fPTK.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        fptkNumber: true,
        positionTitle: true,
        department: true,
        location: true,
        employmentType: true,
        level: true,
        numberOfPositions: true,
        filledPositions: true,
        minEducation: true,
        minExperience: true,
        requiredSkills: true,
        jobDescription: true,
        responsibilities: true,
        qualifications: true,
        salaryRangeMin: true,
        salaryRangeMax: true,
        benefits: true,
        publishedAt: true,
      },
      orderBy: [
        { isPriority: 'desc' },
        { publishedAt: 'desc' },
      ],
    }),
    prisma.fPTK.count({ where }),
  ]);

  return {
    jobs: fptks,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Permanently delete an FPTK and its dependent applications (SUPER_ADMIN only at route layer).
 * Applications must be removed first because Prisma has no onDelete cascade from FPTK -> Application.
 */
async function deleteFPTK(fptkId) {
  const existing = await prisma.fPTK.findUnique({
    where: { id: fptkId },
    select: { id: true, position: true, positionTitle: true },
  });

  if (!existing) {
    throw httpError(404, 'Position not found');
  }

  await prisma.$transaction(async (tx) => {
    await tx.application.deleteMany({ where: { fptkId } });
    await tx.fPTK.delete({ where: { id: fptkId } });
  });

  logger.info(`FPTK deleted: ${fptkId} (${existing.positionTitle || existing.position || 'untitled'})`);

  return { id: fptkId };
}

const BULK_DELETE_MAX = 200;

/**
 * Delete multiple FPTKs in one transaction (applications first, then positions).
 */
async function deleteFPTKsBulk(rawIds) {
  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    throw httpError(400, 'Provide a non-empty ids array');
  }

  const ids = [...new Set(rawIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (ids.length === 0) {
    throw httpError(400, 'No valid ids');
  }
  if (ids.length > BULK_DELETE_MAX) {
    throw httpError(400, `You can delete at most ${BULK_DELETE_MAX} positions per request`);
  }

  const existing = await prisma.fPTK.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  const foundIds = existing.map((e) => e.id);
  if (foundIds.length === 0) {
    throw httpError(404, 'No matching positions found');
  }

  await prisma.$transaction(async (tx) => {
    await tx.application.deleteMany({ where: { fptkId: { in: foundIds } } });
    await tx.fPTK.deleteMany({ where: { id: { in: foundIds } } });
  });

  const notFoundIds = ids.filter((id) => !foundIds.includes(id));
  logger.info(`FPTK bulk delete: ${foundIds.length} position(s) removed`);

  return {
    deletedIds: foundIds,
    deletedCount: foundIds.length,
    notFoundIds,
  };
}

/**
 * Update FPTK filled positions count
 */
async function updateFilledPositions(fptkId) {
  const fptk = await prisma.fPTK.findUnique({
    where: { id: fptkId },
    include: {
      _count: {
        select: {
          applications: {
            where: { status: 'HIRED' },
          },
        },
      },
    },
  });

  if (!fptk) {
    throw new Error('FPTK not found');
  }

  const filledPositions = fptk._count.applications;
  const status = filledPositions >= fptk.numberOfPositions ? 'FILLED' : 
                 filledPositions > 0 ? 'PARTIALLY_FILLED' : 'OPEN';

  await prisma.fPTK.update({
    where: { id: fptkId },
    data: {
      filledPositions,
      status,
    },
  });

  logger.info(`FPTK ${fptkId} filled positions updated: ${filledPositions}/${fptk.numberOfPositions}`);
}

module.exports = {
  createFPTK,
  getFPTKById,
  getAllFPTKs,
  getFptkPositionOptions,
  getFptkCurrentStatusCounts,
  getSummaryByPosition,
  updateFPTK,
  deleteFPTK,
  deleteFPTKsBulk,
  publishFPTK,
  unpublishFPTK,
  getPublishedFPTKs,
  updateFilledPositions,
};

