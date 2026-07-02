import Topbar from '@/components/admin/Topbar';
import QuestionDraftDetail from '@/components/questionBank/QuestionDraftDetail';

export default async function QuestionDraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="문제 검수 · 승인" badge="강사 검토 → 피드백 → 승인" />
      <QuestionDraftDetail id={id} />
    </div>
  );
}
