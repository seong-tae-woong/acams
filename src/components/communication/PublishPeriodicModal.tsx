'use client';
import { useEffect, useState } from 'react';
import Modal from '@/components/shared/Modal';
import Button from '@/components/shared/Button';
import { toast } from '@/lib/stores/toastStore';
import clsx from 'clsx';

interface ClassInfo { id: string; name: string; color: string }
interface StudentInfo { id: string; name: string }

interface Props {
  open: boolean;
  onClose: () => void;
  templateId: string;
  templateName: string;
  classes: ClassInfo[];
  studentsByClass: Record<string, StudentInfo[]>;
  onPublished?: () => void;
}

type Mode = 'class' | 'student';

export default function PublishPeriodicModal({
  open, onClose, templateId, templateName, classes, studentsByClass, onPublished,
}: Props) {
  const [mode, setMode] = useState<Mode>('class');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [summary, setSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setMode('class');
      setSelectedClassIds([]);
      setSelectedStudentIds([]);
      setSummary('');
    }
  }, [open]);

  const targetCount = mode === 'class'
    ? selectedClassIds.reduce((sum, cid) => sum + (studentsByClass[cid]?.length ?? 0), 0)
    : selectedStudentIds.length;

  const toggleClass = (id: string) => {
    setSelectedClassIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };
  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleSubmit = async () => {
    if (targetCount === 0) {
      toast('대상이 없습니다.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/reports/publish-periodic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          classIds: mode === 'class' ? selectedClassIds : undefined,
          studentIds: mode === 'student' ? selectedStudentIds : undefined,
          summary,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || '발행 실패', 'error');
        return;
      }
      toast(`${data.count}명에게 발행 완료 (${data.periodLabel})`, 'success');
      onPublished?.();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${templateName} 발행`}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="default" size="md" onClick={onClose}>취소</Button>
          <Button variant="dark" size="md" onClick={handleSubmit} disabled={submitting || targetCount === 0}>
            {submitting ? '발행 중…' : `${targetCount}명에게 발행`}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="text-[11.5px] font-medium text-[#374151] block mb-1.5">대상</label>
          <div className="flex gap-2 mb-2">
            {(['class', 'student'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={clsx(
                  'px-3 py-1.5 rounded-[6px] text-[11.5px] font-medium cursor-pointer',
                  mode === m ? 'bg-[#1a2535] text-white' : 'bg-[#f1f5f9] text-[#6b7280]',
                )}
              >
                {m === 'class' ? '반 단위' : '학생 단위'}
              </button>
            ))}
          </div>
          {mode === 'class' && (
            <div className="border border-[#e2e8f0] rounded-[8px] max-h-44 overflow-y-auto p-2">
              {classes.map((c) => (
                <label key={c.id} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-[#f4f6f8] rounded px-1.5">
                  <input
                    type="checkbox"
                    checked={selectedClassIds.includes(c.id)}
                    onChange={() => toggleClass(c.id)}
                  />
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="text-[12.5px] text-[#111827] flex-1">{c.name}</span>
                  <span className="text-[10.5px] text-[#9ca3af]">{studentsByClass[c.id]?.length ?? 0}명</span>
                </label>
              ))}
            </div>
          )}
          {mode === 'student' && (
            <div className="border border-[#e2e8f0] rounded-[8px] max-h-44 overflow-y-auto p-2 space-y-2">
              {classes.map((c) => {
                const list = studentsByClass[c.id] ?? [];
                if (list.length === 0) return null;
                return (
                  <div key={c.id}>
                    <div className="text-[10.5px] font-semibold text-[#6b7280] mt-1 mb-1">{c.name}</div>
                    {list.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 py-0.5 pl-2 cursor-pointer hover:bg-[#f4f6f8] rounded">
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(s.id)}
                          onChange={() => toggleStudent(s.id)}
                        />
                        <span className="text-[12.5px] text-[#111827]">{s.name}</span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div>
          <label className="text-[11.5px] font-medium text-[#374151] block mb-1">요약 (선택)</label>
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="비워두면 평균/시험수로 자동 생성"
            className="w-full px-3 py-1.5 border border-[#e2e8f0] rounded-[8px] text-[12.5px]"
          />
        </div>
        <div className="text-[11.5px] text-[#9ca3af]">
          발행 시점 기준 자동으로 기간이 결정됩니다 (월/분기/반기/연).
        </div>
      </div>
    </Modal>
  );
}
