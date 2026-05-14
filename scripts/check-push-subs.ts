import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const subs = await prisma.pushSubscription.findMany({
    include: { user: { select: { name: true, role: true, loginId: true } } },
    orderBy: { createdAt: 'desc' },
  });
  console.log('총 구독 수:', subs.length);
  for (const s of subs) {
    console.log({
      user: `${s.user?.name}/${s.user?.role}/${s.user?.loginId}`,
      endpointHead: s.endpoint.slice(0, 60),
      ua: s.userAgent?.slice(0, 80),
      createdAt: s.createdAt,
    });
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
