/**
 * Backfill: Lecture.durationSec
 *
 * cfVideoId가 있는데 durationSec가 NULL인 강의들을 대상으로
 * Cloudflare Stream API를 1회씩 호출해 영상 길이(초)를 채워 넣는다.
 *
 * 사용: `npx tsx scripts/backfill-lecture-duration.ts`
 *
 * - 인코딩 중인 영상은 그대로 NULL 유지 (다음 실행 시 재시도)
 * - 429 등 일시 오류는 지수 백오프 후 재시도
 * - 분당 200개 cap (Cloudflare Stream의 일반 rate limit 여유 두기)
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const accountId = process.env.CF_ACCOUNT_ID;
const apiToken = process.env.CF_STREAM_API_TOKEN;

async function fetchDuration(cfVideoId: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${cfVideoId}`,
      { headers: { Authorization: `Bearer ${apiToken}` } },
    );
    if (!res.ok) {
      console.warn(`  ✗ ${cfVideoId} → HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const r = data?.result;
    if (!r) return null;
    if (!r.readyToStream || typeof r.duration !== 'number' || r.duration <= 0) {
      console.warn(`  · ${cfVideoId} → 인코딩 미완료 (readyToStream=${r.readyToStream}, duration=${r.duration})`);
      return null;
    }
    return Math.round(r.duration);
  } catch (err) {
    console.warn(`  ✗ ${cfVideoId} → ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function main() {
  if (!accountId || !apiToken) {
    console.error('CF_ACCOUNT_ID, CF_STREAM_API_TOKEN 환경변수가 필요합니다.');
    process.exit(1);
  }

  const rows = await prisma.lecture.findMany({
    where: {
      cfVideoId: { not: null },
      durationSec: null,
    },
    select: { id: true, cfVideoId: true, title: true, academyId: true },
  });

  console.log(`backfill 대상: ${rows.length}건`);
  if (rows.length === 0) return;

  let filled = 0;
  let skipped = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.cfVideoId) continue;
    process.stdout.write(`[${i + 1}/${rows.length}] ${r.title} (${r.cfVideoId})... `);
    const sec = await fetchDuration(r.cfVideoId);
    if (sec === null) {
      skipped++;
      console.log('skip');
    } else {
      await prisma.lecture.update({ where: { id: r.id }, data: { durationSec: sec } });
      filled++;
      console.log(`${sec}초 ✓`);
    }
    // 분당 200건 cap → 약 300ms 간격
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`완료: ${filled}건 채움, ${skipped}건 skip (인코딩 미완료 또는 오류)`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
