import Topbar from '@/components/admin/Topbar';
import MockBuilder from '@/components/questionBank/MockBuilder';

export default function MockPage() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="모의고사 출제" badge="다중 영역 · 순차 생성" />
      <MockBuilder />
    </div>
  );
}
