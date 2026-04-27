import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const tola = await prisma.user.upsert({
    where: { email: 'tola@kova.ai' },
    update: {},
    create: {
      email: 'tola@kova.ai',
      name: 'Tola Adeyemi',
      incomeStreams: {
        create: [
          {
            name: 'Freelance Design',
            type: 'FREELANCE',
            amount: 150000,
            frequency: 'MONTHLY',
            currency: 'NGN',
          },
          {
            name: 'YouTube Channel',
            type: 'CONTENT',
            amount: 45000,
            frequency: 'MONTHLY',
            currency: 'NGN',
          },
        ],
      },
      virtualAccount: {
        create: {
          accountNumber: '9012345678',
          bankName: 'Kova Finance',
          balance: 320000,
          currency: 'NGN',
        },
      },
    },
  })

  console.log('Seeded test user:', tola.name, `(${tola.email})`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
