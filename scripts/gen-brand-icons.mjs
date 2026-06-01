// 학원로그 브랜드 마크(HL) → PNG 아이콘 생성. 규격: DESIGN.md "브랜드 마크".
// 단일 소스(기하학 SVG)에서 파비콘·애플·PWA 아이콘을 재생성한다.
// 실행: node scripts/gen-brand-icons.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const TEAL = '#12B886';
const TEAL_BRIGHT = '#4FC3A1';

// HL 글자(기하학 rect) — viewBox 100x100, 중심(50,50) 기준 letterScale로 확대/축소
function letters(scale) {
  const t = `translate(50 50) scale(${scale}) translate(-50 -50)`;
  return `<g fill="#fff" transform="${t}">
    <rect x="21" y="28" width="12" height="44" rx="2"/>
    <rect x="39" y="28" width="12" height="44" rx="2"/>
    <rect x="21" y="44" width="30" height="12" rx="2"/>
    <rect x="57" y="28" width="12" height="44" rx="2"/>
    <rect x="57" y="60" width="22" height="12" rx="2"/>
  </g>`;
}

function svg({ size, fullbleed, scale }) {
  const rx = fullbleed ? 0 : 24; // 풀블리드(maskable/apple)는 직각, 파비콘은 둥근 사각
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${TEAL}"/><stop offset="1" stop-color="${TEAL_BRIGHT}"/>
    </linearGradient></defs>
    <rect width="100" height="100" rx="${rx}" fill="url(#g)"/>
    ${letters(scale)}
  </svg>`;
}

// 파비콘=둥근 마크(투명 모서리) / 애플·PWA=풀블리드(OS가 모서리 마스킹, HL은 안전영역 안)
const targets = [
  { file: 'src/app/icon.png', size: 256, fullbleed: false, scale: 1.0 },
  { file: 'src/app/apple-icon.png', size: 180, fullbleed: true, scale: 0.9 },
  { file: 'public/icon-192.png', size: 192, fullbleed: true, scale: 0.86 },
  { file: 'public/icon-512.png', size: 512, fullbleed: true, scale: 0.86 },
];

for (const t of targets) {
  const out = resolve(root, t.file);
  await sharp(Buffer.from(svg(t))).png().toFile(out);
  console.log(`✓ ${t.file} (${t.size}px, ${t.fullbleed ? 'full-bleed' : 'rounded'})`);
}
console.log('done.');
