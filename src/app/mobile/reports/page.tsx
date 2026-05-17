import { redirect } from 'next/navigation';

// 리포트 목록은 /mobile/grades에서 제공 — 리포트 발행 푸시 알림(url: /mobile/reports)
// 및 직접 접근을 목록 페이지로 연결
export default function MobileReportsPage() {
  redirect('/mobile/grades');
}
