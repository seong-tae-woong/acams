/**
 * Migration: YouTube + examCond='after100' → 'anytime'
 *
 * YouTube 강의(cfVideoId=null, videoUrl≠null)는 시청률 추적이 불가하므로
 * examCond='after100' 시험에 시작 단계에서 영구 BLOCKED 됨 (silent failure).
 * 이 스크립트는 그런 조합을 일괄 'anytime'으로 전환하여 학생들이 시험을 응시할 수 있게 한다.
 *
 * 사용:
 *   npx tsx scripts/migrate-youtube-exam-cond.ts          # dry-run (변경 안 함)
 *   npx tsx scripts/migrate-youtube-exam-cond.ts --apply  # 실제 적용
 *
 * - idempotent: 재실행해도 무해 (이미 anytime이면 매칭 안 됨)
 * - DB 연결 host를 시작 시 stdout에 출력 (production Neon 오인 방지)
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const APPLY = process.argv.includes('--apply');

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('ERROR: DATABASE_URL 환경변수가 설정되어 있지 않습니다.');
  process.exit(1);
}

// connection target host 출력 — 잘못된 DB 변경 방지용
try {
  const u = new URL(dbUrl);
  console.log(`[migrate] DATABASE_URL host = ${u.host} (database=${u.pathname.slice(1)})`);
} catch {
  console.log('[migrate] DATABASE_URL 형식 파싱 실패 — 그대로 진행');
}
console.log(`[migrate] mode = ${APPLY ? 'APPLY (실제 변경)' : 'DRY-RUN (변경 안 함)'}\n`);

const adapter = new PrismaPg({ connectionString: dbUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 대상 조회: YouTube predicate (cfVideoId=null AND videoUrl≠null) + examCond='after100'
  const targets = await prisma.lectureQuiz.findMany({
    where: {
      examCond: 'after100',
      lecture: {
        cfVideoId: null,
        videoUrl: { not: null },
      },
    },
    select: {
      id: true,
      lectureId: true,
      academyId: true,
      lecture: { select: { title: true, videoUrl: true } },
    },
  });

  if (targets.length === 0) {
    console.log('대상 강의 없음 — 마이그레이션 불필요.');
    return;
  }

  console.log(`대상 ${targets.length}건 발견:`);
  for (const t of targets) {
    console.log(
      `  - quiz=${t.id} | lecture=${t.lectureId} (${t.lecture.title}) | videoUrl=${t.lecture.videoUrl?.slice(0, 60)}...`,
    );
  }

  if (!APPLY) {
    console.log('\nDRY-RUN: 실제 적용하려면 --apply 플래그를 붙여 다시 실행하세요.');
    return;
  }

  const result = await prisma.lectureQuiz.updateMany({
    where: { id: { in: targets.map((t) => t.id) } },
    data: { examCond: 'anytime' },
  });
  console.log(`\n✅ ${result.count}건 'after100' → 'anytime' 변경 완료.`);
}

main()
  .catch((err) => {
    console.error('[migrate] 실패:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
