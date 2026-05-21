/**
 * 빌드 시점 필수 환경변수 체크 스크립트
 * package.json build 스크립트에서 prisma generate 전에 실행
 *
 * 사용: node scripts/check-env.mjs
 */

const REQUIRED = [
  // 인증
  'JWT_SECRET',
  'DATABASE_URL',
  // 결제
  'TOSS_KEY_ENC_SECRET',
  // Cloudflare Stream (인강 영상 업로드)
  'CF_ACCOUNT_ID',
  'CF_STREAM_API_TOKEN',
];

const missing = REQUIRED.filter((k) => !process.env[k]);

if (missing.length > 0) {
  console.error('\n❌ 필수 환경변수 누락:');
  missing.forEach((k) => console.error(`   - ${k}`));
  console.error('\nVercel 대시보드 또는 .env.local 에 추가 후 다시 빌드하세요.\n');
  process.exit(1);
}

console.log('✅ 환경변수 체크 통과');
