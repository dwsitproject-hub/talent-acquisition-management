const prismaBase = require('../config/prismaBase');
const auditService = require('../services/auditService');
const { isAuditSuppressed } = require('../utils/auditContext');

const AUDIT_SKIP_MODELS = new Set([
  'AuditLog',
  'RefreshToken',
  'ApplicationStatusHistory',
  'FPTKStatusHistory',
]);

const MODEL_DELEGATE = {
  User: 'user',
  RefreshToken: 'refreshToken',
  Candidate: 'candidate',
  Education: 'education',
  WorkExperience: 'workExperience',
  Certification: 'certification',
  Reference: 'reference',
  FPTK: 'fPTK',
  FPTKStatusHistory: 'fPTKStatusHistory',
  Application: 'application',
  OnboardingJoinReminderDispatch: 'onboardingJoinReminderDispatch',
  ApplicationStatusHistory: 'applicationStatusHistory',
  Test: 'test',
  Interview: 'interview',
  InterviewFeedback: 'interviewFeedback',
  Document: 'document',
  CandidateFormToken: 'candidateFormToken',
  Offer: 'offer',
  Onboarding: 'onboarding',
  OnboardingTask: 'onboardingTask',
  Notification: 'notification',
  AuditLog: 'auditLog',
  RecruitmentMetric: 'recruitmentMetric',
  MasterDivision: 'masterDivision',
  MasterOfficeLocation: 'masterOfficeLocation',
  IndonesiaHoliday: 'indonesiaHoliday',
  MenuAccess: 'menuAccess',
};

function getDelegate(model) {
  return MODEL_DELEGATE[model] || null;
}

async function fetchExistingRecord(model, where) {
  const delegate = getDelegate(model);
  if (!delegate || !where || !prismaBase[delegate]) return null;

  try {
    return await prismaBase[delegate].findFirst({ where });
  } catch {
    return null;
  }
}

function queueAudit(payload) {
  if (payload.entity && isAuditSuppressed(payload.entity)) {
    return;
  }
  if (payload.action === 'UPDATE' && auditService.isNoOpAuditChange(payload.oldValues, payload.newValues)) {
    return;
  }
  auditService.writeAuditLog(payload).catch(() => {});
}

function createAuditExtension() {
  return {
    query: {
      $allModels: {
        async create({ model, args, query }) {
          const result = await query(args);
          if (!AUDIT_SKIP_MODELS.has(model)) {
            queueAudit({
              action: 'CREATE',
              entity: model,
              entityId: auditService.extractEntityId(result, args.where),
              newValues: result,
            });
          }
          return result;
        },
        async createMany({ model, args, query }) {
          const result = await query(args);
          if (!AUDIT_SKIP_MODELS.has(model)) {
            queueAudit({
              action: 'CREATE',
              entity: model,
              entityId: null,
              newValues: { count: result.count, data: args.data },
            });
          }
          return result;
        },
        async update({ model, args, query }) {
          const oldValues = AUDIT_SKIP_MODELS.has(model)
            ? null
            : await fetchExistingRecord(model, args.where);
          const result = await query(args);
          if (!AUDIT_SKIP_MODELS.has(model)) {
            queueAudit({
              action: 'UPDATE',
              entity: model,
              entityId: auditService.extractEntityId(result, args.where),
              oldValues,
              newValues: result,
            });
          }
          return result;
        },
        async updateMany({ model, args, query }) {
          const result = await query(args);
          if (!AUDIT_SKIP_MODELS.has(model)) {
            queueAudit({
              action: 'UPDATE',
              entity: model,
              entityId: null,
              oldValues: { where: args.where },
              newValues: { count: result.count, data: args.data },
            });
          }
          return result;
        },
        async upsert({ model, args, query }) {
          const oldValues = AUDIT_SKIP_MODELS.has(model)
            ? null
            : await fetchExistingRecord(model, args.where);
          const result = await query(args);
          if (!AUDIT_SKIP_MODELS.has(model)) {
            queueAudit({
              action: oldValues ? 'UPDATE' : 'CREATE',
              entity: model,
              entityId: auditService.extractEntityId(result, args.where),
              oldValues,
              newValues: result,
            });
          }
          return result;
        },
        async delete({ model, args, query }) {
          const oldValues = AUDIT_SKIP_MODELS.has(model)
            ? null
            : await fetchExistingRecord(model, args.where);
          const result = await query(args);
          if (!AUDIT_SKIP_MODELS.has(model)) {
            queueAudit({
              action: 'DELETE',
              entity: model,
              entityId: auditService.extractEntityId(oldValues, args.where),
              oldValues,
              newValues: result,
            });
          }
          return result;
        },
        async deleteMany({ model, args, query }) {
          const result = await query(args);
          if (!AUDIT_SKIP_MODELS.has(model)) {
            queueAudit({
              action: 'DELETE',
              entity: model,
              entityId: null,
              oldValues: { where: args.where },
              newValues: { count: result.count },
            });
          }
          return result;
        },
      },
    },
  };
}

module.exports = {
  createAuditExtension,
  AUDIT_SKIP_MODELS,
};
