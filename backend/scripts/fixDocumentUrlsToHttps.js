/**
 * One-off fix for documents whose `fileUrl` was baked in with `http://` (e.g. because
 * API_BASE_URL was misconfigured without SSL at upload time). Those URLs get hard-blocked
 * as mixed content once the app is served over HTTPS, breaking view/download in the UI.
 *
 * This rewrites the scheme to `https://` in place (host/path/filename are untouched), so
 * existing documents work immediately without re-uploading.
 *
 * Usage:
 *   cd backend
 *   node scripts/fixDocumentUrlsToHttps.js          # dry run, only prints what would change
 *   node scripts/fixDocumentUrlsToHttps.js --apply  # actually updates the database
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes('--apply');

  const documents = await prisma.document.findMany({
    where: { fileUrl: { startsWith: 'http://' } },
    select: { id: true, candidateId: true, originalName: true, fileUrl: true },
  });

  if (documents.length === 0) {
    console.log('No documents found with an http:// fileUrl. Nothing to do.');
    return;
  }

  console.log(`Found ${documents.length} document(s) with an http:// fileUrl:`);
  for (const doc of documents) {
    const newUrl = `https://${doc.fileUrl.slice('http://'.length)}`;
    console.log(`- [${doc.id}] ${doc.originalName}\n    ${doc.fileUrl}\n    -> ${newUrl}`);
  }

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to update the database.');
    return;
  }

  let updated = 0;
  for (const doc of documents) {
    const newUrl = `https://${doc.fileUrl.slice('http://'.length)}`;
    await prisma.document.update({
      where: { id: doc.id },
      data: { fileUrl: newUrl },
    });
    updated += 1;
  }

  console.log(`\nUpdated ${updated} document(s) to https://.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
