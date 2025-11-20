const path = require('path');
const fs = require('fs/promises');
const { v4: uuidv4 } = require('uuid');

const prisma = require('../config/database');
const logger = require('../utils/logger');

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.xlsx', '.xls'];
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);

function sanitizeFileName(name) {
  const baseName = path.basename(name);
  return baseName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function removeFileIfExists(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.warn(`Failed to delete file ${filePath}: ${error.message}`);
    }
  }
}

async function moveUploadedFile(tempFile, destination) {
  await new Promise((resolve, reject) => {
    tempFile.mv(destination, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function uploadCandidateDocument(candidateId, file, options = {}) {
  if (!candidateId) {
    throw new Error('Candidate ID is required');
  }

  if (!file) {
    throw new Error('No file uploaded');
  }

  const { documentType = 'RESUME', baseUrl } = options;

  let normalizedType = String(documentType || 'RESUME').toUpperCase();
  
  // Map 'ADDITIONAL' to 'OTHER' since ADDITIONAL is not a valid enum value
  if (normalizedType === 'ADDITIONAL') {
    normalizedType = 'OTHER';
  }
  
  // Validate that the type is a valid DocumentType enum value
  const validTypes = ['RESUME', 'COVER_LETTER', 'ID_CARD', 'DIPLOMA', 'TRANSCRIPT', 
                      'CERTIFICATE', 'REFERENCE_LETTER', 'MEDICAL_REPORT', 'PHOTO', 'OTHER'];
  if (!validTypes.includes(normalizedType)) {
    throw new Error(`Invalid document type: ${normalizedType}. Valid types are: ${validTypes.join(', ')}`);
  }

  const extension = path.extname(file.name || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    throw new Error('Unsupported file extension');
  }

  const mimeType = file.mimetype;
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error('Unsupported file type');
  }

  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
  if (!candidate) {
    throw new Error('Candidate not found');
  }

  const uploadsRoot = path.join(__dirname, '../../uploads');
  const candidateDirectory = path.join(uploadsRoot, 'candidates', candidateId);
  await ensureDirectory(candidateDirectory);

  const originalName = sanitizeFileName(file.name || 'document');
  const uniqueName = `${uuidv4()}${extension}`;
  const absolutePath = path.join(candidateDirectory, uniqueName);

  try {
    await moveUploadedFile(file, absolutePath);
  } catch (error) {
    logger.error(`Failed to store uploaded document for candidate ${candidateId}: ${error.message}`);
    throw new Error('Failed to save uploaded file');
  }

  const relativePath = path.posix.join('uploads', 'candidates', candidateId, uniqueName);
  const rawBase = (baseUrl || process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
  // Ensure the base URL does not include the API prefix so the static /uploads route works correctly
  const base = rawBase.replace(/\/api(?:\/)?$/i, '');
  const fileUrl = `${base}/${relativePath}`;

  // For RESUME type, update if exists (only one resume per candidate)
  // For ALL other types (including OTHER), always create new documents (allow multiple)
  // CRITICAL: Never update OTHER documents - always create new ones
  logger.info(`[UPLOAD] Processing document type: ${normalizedType} for candidate ${candidateId}`);
  
  if (normalizedType === 'RESUME') {
    logger.info(`[UPLOAD] RESUME type detected - checking for existing document...`);
    const existingDocument = await prisma.document.findFirst({
      where: {
        candidateId,
        documentType: normalizedType,
      },
    });

    if (existingDocument) {
      logger.info(`[UPLOAD] Found existing RESUME document, updating it...`);
      const previousPath = path.join(candidateDirectory, existingDocument.fileName);
      await removeFileIfExists(previousPath);

      const updatedDocument = await prisma.document.update({
        where: { id: existingDocument.id },
        data: {
          fileName: uniqueName,
          originalName,
          fileSize: file.size,
          mimeType,
          fileUrl,
          uploadedAt: new Date(),
        },
      });

      logger.info(`Updated ${normalizedType} document for candidate ${candidateId}`);
      return updatedDocument;
    } else {
      logger.info(`[UPLOAD] No existing RESUME document found, will create new one`);
    }
  } else {
    logger.info(`[UPLOAD] Non-RESUME type (${normalizedType}) - will always create new document (skipping update check)`);
  }
  // For all other types (including OTHER), always create new document (skip update logic)

  logger.info(`Creating new ${normalizedType} document for candidate ${candidateId}: ${originalName} (${file.size} bytes)`);
  
  const createdDocument = await prisma.document.create({
    data: {
      candidateId,
      documentType: normalizedType,
      fileName: uniqueName,
      originalName,
      fileSize: file.size,
      mimeType,
      fileUrl,
    },
  });

  logger.info(`Successfully created ${normalizedType} document with ID ${createdDocument.id} for candidate ${candidateId}: ${originalName}`);
  
  // Log total documents for this candidate after creation
  const totalDocs = await prisma.document.count({
    where: { candidateId }
  });
  const otherDocs = await prisma.document.count({
    where: { candidateId, documentType: 'OTHER' }
  });
  logger.info(`Candidate ${candidateId} now has ${totalDocs} total documents (${otherDocs} OTHER type documents)`);
  
  // List all OTHER documents for debugging
  if (normalizedType === 'OTHER') {
    const allOtherDocs = await prisma.document.findMany({
      where: { candidateId, documentType: 'OTHER' },
      select: { id: true, originalName: true, fileName: true, uploadedAt: true }
    });
    logger.info(`All OTHER documents for candidate ${candidateId}:`, JSON.stringify(allOtherDocs, null, 2));
  }
  
  return createdDocument;
}

async function getCandidateDocuments(candidateId) {
  if (!candidateId) {
    throw new Error('Candidate ID is required');
  }

  const documents = await prisma.document.findMany({
    where: { candidateId },
    orderBy: { uploadedAt: 'desc' },
  });
  
  logger.info(`Retrieved ${documents.length} documents for candidate ${candidateId}`);
  logger.debug(`Document types: ${documents.map(d => d.documentType).join(', ')}`);
  
  return documents;
}

module.exports = {
  uploadCandidateDocument,
  getCandidateDocuments,
};
