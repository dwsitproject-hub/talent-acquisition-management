/**
 * Dashboard demo seed — idempotent for rows tagged with SEED-DEMO-* FPTK numbers.
 * Run: npx prisma db seed   (from backend/, DATABASE_URL set)
 * Docker: docker compose exec backend npx prisma db seed
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const SEED_PREFIX = 'SEED-DEMO';
const DEMO_CANDIDATE_EMAILS = [
  'demo.candidate.1@tas.local',
  'demo.candidate.2@tas.local',
  'demo.candidate.3@tas.local',
  'demo.candidate.4@tas.local',
  'demo.candidate.5@tas.local',
];

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d;
}

function thisWeekDay(offsetFromMonday) {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  monday.setHours(10, 0, 0, 0);
  monday.setDate(monday.getDate() + offsetFromMonday);
  return monday;
}

async function wipePreviousSeed() {
  const seedFptkIds = (
    await prisma.fPTK.findMany({
      where: { fptkNumber: { startsWith: SEED_PREFIX } },
      select: { id: true },
    })
  ).map((f) => f.id);

  const demoUsers = await prisma.user.findMany({
    where: { email: { in: DEMO_CANDIDATE_EMAILS } },
    select: { id: true },
  });
  const demoUserIds = demoUsers.map((u) => u.id);
  const demoCandidateIds = (
    await prisma.candidate.findMany({
      where: { userId: { in: demoUserIds } },
      select: { id: true },
    })
  ).map((c) => c.id);

  const appOr = [];
  if (seedFptkIds.length) appOr.push({ fptkId: { in: seedFptkIds } });
  if (demoCandidateIds.length) appOr.push({ candidateId: { in: demoCandidateIds } });

  if (appOr.length) {
    const appWhere = appOr.length === 1 ? appOr[0] : { OR: appOr };
    await prisma.interview.deleteMany({ where: { application: appWhere } });
    await prisma.application.deleteMany({ where: appWhere });
  }

  if (seedFptkIds.length) {
    await prisma.fPTKStatusHistory.deleteMany({ where: { fptkId: { in: seedFptkIds } } });
    await prisma.fPTK.deleteMany({ where: { id: { in: seedFptkIds } } });
  }

  if (demoUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: demoUserIds } } });
  }
}

async function main() {
  const admin = await prisma.user.findFirst({
    where: { email: 'admin@kpn.com', role: 'SUPER_ADMIN' },
  });

  if (!admin) {
    console.error('No admin@kpn.com SUPER_ADMIN user found. Run: node scripts/createAdmin.js');
    process.exit(1);
  }

  await wipePreviousSeed();

  const passwordHash = await bcrypt.hash('Candidate123!', 12);

  const candidateRecords = [];
  for (let i = 0; i < DEMO_CANDIDATE_EMAILS.length; i++) {
    const email = DEMO_CANDIDATE_EMAILS[i];
    const user = await prisma.user.create({
      data: {
        email,
        password: passwordHash,
        firstName: ['Ayu', 'Budi', 'Citra', 'Dedi', 'Eka'][i],
        lastName: 'Wijaya',
        phoneNumber: `+62810000000${i}`,
        role: 'CANDIDATE',
        isActive: true,
        isEmailVerified: true,
      },
    });
    const candidate = await prisma.candidate.create({
      data: {
        userId: user.id,
        skills: ['JavaScript', 'PostgreSQL'],
        currentJobTitle: 'Software Engineer',
        currentCompany: 'PT Contoh',
      },
    });
    candidateRecords.push({ user, candidate });
  }

  const fptkSpecs = [
    {
      num: `${SEED_PREFIX}-001`,
      position: 'Senior Backend Engineer',
      currentStatus: 'Open',
      area: 'Jakarta',
      areaDetail: 'Jakarta HQ',
      requestDaysAgo: 8,
      status: 'OPEN',
    },
    {
      num: `${SEED_PREFIX}-002`,
      position: 'Data Engineer',
      currentStatus: 'open',
      area: 'Jakarta',
      areaDetail: 'Jakarta HQ',
      requestDaysAgo: 42,
      status: 'OPEN',
    },
    {
      num: `${SEED_PREFIX}-003`,
      position: 'HR Business Partner',
      currentStatus: 'Re-Open',
      area: 'Surabaya',
      areaDetail: 'Surabaya Plant',
      requestDaysAgo: 5,
      status: 'OPEN',
    },
    {
      num: `${SEED_PREFIX}-004`,
      position: 'Talent Acquisition Specialist',
      currentStatus: 'Hold',
      area: 'Surabaya',
      areaDetail: 'Surabaya Plant',
      requestDaysAgo: 70,
      status: 'OPEN',
    },
    {
      num: `${SEED_PREFIX}-005`,
      position: 'Finance Manager',
      currentStatus: 'close',
      area: 'Bandung',
      areaDetail: 'Bandung Office',
      requestDaysAgo: 20,
      status: 'FILLED',
    },
    {
      num: `${SEED_PREFIX}-006`,
      position: 'Internal Auditor',
      currentStatus: 'Close',
      area: 'Bandung',
      areaDetail: 'Bandung Office',
      requestDaysAgo: 12,
      status: 'FILLED',
    },
    {
      num: `${SEED_PREFIX}-007`,
      position: 'DevOps Engineer',
      currentStatus: 'Open',
      area: 'Medan',
      areaDetail: 'Medan Branch',
      requestDaysAgo: 100,
      status: 'OPEN',
    },
    {
      num: `${SEED_PREFIX}-008`,
      position: 'Product Owner',
      currentStatus: 'Pending FKTK',
      area: 'Medan',
      areaDetail: 'Medan Branch',
      requestDaysAgo: 3,
      status: 'APPROVED',
    },
  ];

  const fptkRows = [];
  for (const spec of fptkSpecs) {
    const requestDate = daysAgo(spec.requestDaysAgo);
    const fptk = await prisma.fPTK.create({
      data: {
        fptkNumber: spec.num,
        position: spec.position,
        positionTitle: spec.position,
        department: 'Technology',
        division: 'Digital',
        location: spec.areaDetail,
        employmentType: 'Permanent',
        level: 'Senior',
        numberOfPositions: 2,
        filledPositions: spec.status === 'FILLED' ? 2 : 0,
        requiredSkills: ['Communication', 'Analysis'],
        minEducation: 'Bachelor',
        minExperience: 3,
        jobDescription: 'Demo position for dashboard charts.',
        pt: 'PT KPN Demo',
        noFktk: spec.num.replace(SEED_PREFIX, 'FKTK'),
        statusFktk: 'Approved',
        hiringManager: admin.firstName,
        area: spec.area,
        areaDetail: spec.areaDetail,
        requestDate,
        fptkReceiveDate: requestDate,
        currentStatus: spec.currentStatus,
        status: spec.status,
        isPublished: true,
        createdBy: admin.id,
        remark: 'Seeded demo data — safe to delete FPTKs with prefix SEED-DEMO.',
      },
    });
    fptkRows.push(fptk);
  }

  const appStatuses = [
    'SUBMITTED',
    'SCREENING',
    'INTERVIEW_SCHEDULED',
    'INTERVIEW_COMPLETED',
    'SUBMITTED',
  ];

  const applications = [];
  for (let i = 0; i < candidateRecords.length; i++) {
    const { candidate } = candidateRecords[i];
    const fptk = fptkRows[i % fptkRows.length];
    const app = await prisma.application.create({
      data: {
        candidateId: candidate.id,
        fptkId: fptk.id,
        status: appStatuses[i],
        currentStage: 3,
        source: 'Demo Seed',
      },
    });
    applications.push({ app, candidate, fptk });
  }

  const weekInterviewApp = applications.find((a) => a.app.status === 'INTERVIEW_SCHEDULED');
  const weekInterviewApp2 = applications.find((a) => a.app.status === 'INTERVIEW_COMPLETED');

  if (weekInterviewApp) {
    await prisma.interview.create({
      data: {
        applicationId: weekInterviewApp.app.id,
        candidateId: weekInterviewApp.candidate.id,
        interviewType: 'TECHNICAL_INTERVIEW',
        status: 'SCHEDULED',
        scheduledAt: thisWeekDay(2),
        duration: 60,
        location: 'Meeting Room A',
        interviewerName: 'Demo Interviewer',
      },
    });
  }
  if (weekInterviewApp2) {
    await prisma.interview.create({
      data: {
        applicationId: weekInterviewApp2.app.id,
        candidateId: weekInterviewApp2.candidate.id,
        interviewType: 'HR_INTERVIEW',
        status: 'CONFIRMED',
        scheduledAt: thisWeekDay(4),
        duration: 45,
        meetingLink: 'https://meet.example.com/demo',
        interviewerName: 'HR Demo',
      },
    });
  }

  const futureApp = applications[0];
  await prisma.interview.create({
    data: {
      applicationId: futureApp.app.id,
      candidateId: futureApp.candidate.id,
      interviewType: 'PHONE_SCREEN',
      status: 'SCHEDULED',
      scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      duration: 30,
      interviewerName: 'Screener',
    },
  });

  const hiredFptk = fptkRows.find((f) => f.fptkNumber === `${SEED_PREFIX}-005`);
  if (hiredFptk) {
    await prisma.fPTK.update({
      where: { id: hiredFptk.id },
      data: {
        currentStatus: 'close',
        status: 'FILLED',
        updatedAt: new Date(),
      },
    });
  }

  console.log('Dashboard demo seed completed.');
  console.log(`  FPTKs: ${fptkRows.length} (${SEED_PREFIX}-*)`);
  console.log(`  Candidates (login portal): ${DEMO_CANDIDATE_EMAILS.join(', ')}`);
  console.log('  Password for all demo candidates: Candidate123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
