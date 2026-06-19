'use client';
import Topbar from '@/components/admin/Topbar';
import LevelTestFormsEditor from '@/components/levelTest/LevelTestFormsEditor';

export default function LevelTestFormsPage() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="레벨 테스트 양식" badge="학년별 시험지·유형 등록" />
      <LevelTestFormsEditor />
    </div>
  );
}
