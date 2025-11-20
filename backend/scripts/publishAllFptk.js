const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await prisma.fPTK.updateMany({
      data: { isPublished: true, publishedAt: new Date() },
      where: { isPublished: false },
    });
    console.log('Published FPTK count:', result.count);
  } catch (e) {
    console.error('Error publishing FPTK:', e.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();


