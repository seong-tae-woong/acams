import Topbar from '@/components/admin/Topbar';
import QuestionGenerator from '@/components/questionBank/QuestionGenerator';

export default function QuestionsPage() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="문제 출제" badge="AI 생성 · 검수 · 승인" />
      <QuestionGenerator />
    </div>
  );
}
