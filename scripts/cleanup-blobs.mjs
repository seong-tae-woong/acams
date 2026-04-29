/**
 * cleanup-blobs.mjs
 * Vercel Blob에 고아(orphan) 상태로 남아있는 갤러리 이미지를 정리합니다.
 * DB에 참조되지 않는 galleries/ 하위 모든 blob을 삭제합니다.
 *
 * 실행: node scripts/cleanup-blobs.mjs
 */

import { list, del } from '@vercel/blob';
import pg from 'pg';

const { Client } = pg;

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;

if (!BLOB_TOKEN || !DATABASE_URL) {
  console.error('❌  환경변수 BLOB_READ_WRITE_TOKEN 또는 DATABASE_URL이 없습니다.');
  process.exit(1);
}

async function main() {
  // ── 1. DB에 현재 저장된 Blob URL 수집 ──────────────────────────────────
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const { rows } = await client.query(
    `SELECT "galleryImages" FROM "academies" WHERE "galleryImages" IS NOT NULL`
  );
  await client.end();

  const dbUrls = new Set();
  for (const row of rows) {
    const images = row.galleryImages;
    if (Array.isArray(images)) {
      for (const url of images) {
        if (url && typeof url === 'string') dbUrls.add(url);
      }
    }
  }

  console.log(`\n📦  DB에 참조된 blob URL: ${dbUrls.size}개`);
  if (dbUrls.size > 0) {
    for (const url of dbUrls) console.log('   ✅', url);
  }

  // ── 2. Vercel Blob의 galleries/ 하위 목록 전체 수집 ─────────────────────
  const allBlobs = [];
  let cursor;

  do {
    const res = await list({
      prefix: 'galleries/',
      token: BLOB_TOKEN,
      ...(cursor && { cursor }),
    });
    allBlobs.push(...res.blobs);
    cursor = res.cursor;
  } while (cursor);

  console.log(`\n☁️   Blob 스토리지 내 galleries/ 파일: ${allBlobs.length}개`);

  // ── 3. 고아 blob 판별 ────────────────────────────────────────────────────
  const orphans = allBlobs.filter((b) => !dbUrls.has(b.url));

  if (orphans.length === 0) {
    console.log('\n✨  고아 blob 없음 — 정리할 것이 없습니다.');
    return;
  }

  console.log(`\n🗑️   고아 blob ${orphans.length}개 삭제 시작:`);
  for (const blob of orphans) {
    console.log('   삭제:', blob.url);
    await del(blob.url, { token: BLOB_TOKEN });
  }

  console.log(`\n✅  완료 — ${orphans.length}개 삭제됨.`);
}

main().catch((err) => {
  console.error('❌  스크립트 오류:', err);
  process.exit(1);
});
