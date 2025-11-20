require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  try {
    // Check current FPTK records
    const fptks = await prisma.fPTK.findMany({
      select: {
        id: true,
        fptkNumber: true,
        currentStatus: true,
        status: true,
      },
      take: 10
    })
    
    console.log('Current FPTK records:')
    console.log(JSON.stringify(fptks, null, 2))
    
    // Update records that have NULL currentStatus
    const result1 = await prisma.fPTK.updateMany({
      where: {
        currentStatus: null
      },
      data: {
        currentStatus: 'Raise FPTK'
      }
    })
    
    console.log(`\nUpdated ${result1.count} FPTK records with NULL currentStatus to 'Raise FPTK'`)
    
    // Update records that have "Pending" (invalid value) to "Raise FPTK"
    const result2 = await prisma.fPTK.updateMany({
      where: {
        currentStatus: 'Pending'
      },
      data: {
        currentStatus: 'Raise FPTK'
      }
    })
    
    console.log(`Updated ${result2.count} FPTK records with 'Pending' currentStatus to 'Raise FPTK'`)
    
    // Check again
    const updatedFptks = await prisma.fPTK.findMany({
      select: {
        id: true,
        fptkNumber: true,
        currentStatus: true,
        status: true,
      },
      take: 10
    })
    
    console.log('\nUpdated FPTK records:')
    console.log(JSON.stringify(updatedFptks, null, 2))
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()

