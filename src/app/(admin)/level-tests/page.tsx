'use client';
import Topbar from '@/components/admin/Topbar';
import LevelTestRunner from '@/components/levelTest/LevelTestRunner';

export default function LevelTestPage() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="레벨 테스트" badge="실시 · 채점 · 리포트 발행" />
      <LevelTestRunner />
    </div>
  );
}
