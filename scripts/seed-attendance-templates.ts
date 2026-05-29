/**
 * Seed: 자동 결석/지각 알림 NotificationTemplate
 *
 * 모든 활성 학원에 대해 시드 템플릿 2개를 upsert.
 * - ATTENDANCE_LATE_AUTO  : 지각 자동 알림
 * - ATTENDANCE_ABSENT_AUTO: 결석 자동 알림
 *
 * 사용: `npx tsx scripts/seed-attendance-templates.ts`
 *
 * idempotent — 여러 번 실행해도 안전. (academyId, code) UNIQUE 키로 upsert.
 * 기존에 학원이 본문을 수정했다면 그대로 보존 (`update: {}` 비워두어서).
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const SEEDS = [
  {
    code: 'ATTENDANCE_LATE_AUTO',
    category: 'ATTENDANCE_ALERT' as const,
    title: '[지각 알림] {학생명} 학생이 아직 도착하지 않았어요',
    content:
      '{학생명} 학생이 오늘 {수업명} 수업({수업시간}) 시작 후 {임계분}분이 지났는데 ' +
      '아직 출석 체크가 되지 않았어요.\n\n' +
      '등원이 늦어지거나 못 오는 사정이 있으면 학원으로 알려주시면 감사하겠습니다.',
  },
  {
    code: 'ATTENDANCE_ABSENT_AUTO',
    category: 'ATTENDANCE_ALERT' as const,
    title: '[결석 알림] {학생명} 학생이 {수업명} 수업에 결석한 것으로 확인됩니다',
    content:
      '{학생명} 학생이 오늘 {수업명} 수업({수업시간}) 시작 후 {임계분}분이 지나도록 ' +
      '출석 체크가 되지 않아 결석으로 안내드립니다.\n\n' +
      '사정이 있으셨다면 학원에 연락 부탁드리며, ' +
      '보강이 필요하시면 학원에서 일정을 안내드리겠습니다.',
  },
];

async function main() {
  const academies = await prisma.academy.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  console.log(`🌱 ${academies.length}개 학원에 자동 알림 템플릿 시드 시작`);

  let created = 0;
  let skipped = 0;

  for (const a of academies) {
    for (const tpl of SEEDS) {
      const existing = await prisma.notificationTemplate.findUnique({
        where: { academyId_code: { academyId: a.id, code: tpl.code } },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      await prisma.notificationTemplate.create({
        data: {
          academyId: a.id,
          code: tpl.code,
          category: tpl.category,
          title: tpl.title,
          content: tpl.content,
        },
      });
      created += 1;
      console.log(`  ✓ ${a.name} → ${tpl.code}`);
    }
  }

  console.log(`✅ 완료 — 신규 ${created}개, 기존 보존 ${skipped}개`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
