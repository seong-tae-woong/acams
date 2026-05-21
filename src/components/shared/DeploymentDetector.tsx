'use client';
/**
 * DeploymentDetector
 *
 * 새 Vercel 배포가 감지되면 페이지를 한 번 hard reload합니다.
 * 목적: 배포 후 브라우저에 남아있는 구 JS 번들·RSC 캐시가 새 서버 코드와
 *       충돌해 에러가 나는 문제를 자동으로 해결합니다.
 *
 * 동작:
 *   - NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA를 sessionStorage에 저장
 *   - 페이지 로드 시 저장값과 다르면(=새 배포) → hard reload 1회
 *   - 같으면 → 아무 것도 안 함 (무한 루프 방지)
 *   - 로컬 개발(env 없음)에서는 동작 안 함
 */
import { useEffect } from 'react';

const BUILD_ID = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
const STORAGE_KEY = 'acams_build_id';

export default function DeploymentDetector() {
  useEffect(() => {
    if (!BUILD_ID) return; // 로컬 개발 환경 — 아무 것도 안 함

    const stored = sessionStorage.getItem(STORAGE_KEY);

    if (stored !== null && stored !== BUILD_ID) {
      // 새 배포 감지 → 캐시 초기화 후 hard reload
      sessionStorage.setItem(STORAGE_KEY, BUILD_ID);
      window.location.reload();
    } else {
      // 최초 방문 또는 동일 배포 — 저장만
      sessionStorage.setItem(STORAGE_KEY, BUILD_ID);
    }
  }, []);

  return null;
}
