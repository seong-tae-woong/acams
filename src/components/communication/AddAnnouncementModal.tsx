'use client';
import { useState, useEffect } from 'react';
import Modal from '@/components/shared/Modal';
import Button from '@/components/shared/Button';
import { useCommunicationStore } from '@/lib/stores/communicationStore';
import { useClassStore } from '@/lib/stores/classStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AddAnnouncementModal({ open, onClose }: Props) {
  const { addAnnouncement } = useCommunicationStore();
  const { classes, fetchClasses } = useClassStore();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pinned, setPinned] = useState(false);
  const [classId, setClassId] = useState<string>(''); // '' = 전체
  const [publishNow, setPublishNow] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (classes.length === 0) fetchClasses();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) {
      setTitle('');
      setContent('');
      setPinned(false);
      setClassId('');
      setPublishNow(true);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setSubmitting(true);
    try {
      await addAnnouncement({
        title: title.trim(),
        content: content.trim(),
        pinned,
        status: publishNow ? '게시됨' : '임시저장',
        author: '',
        targetAudience: classId ? [classId] : ['all'],
        attachments: [],
        classId: classId || null,
      });
      onClose();
    } catch {
      // 에러는 store에서 toast로 처리
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1] focus:ring-2 focus:ring-[#4fc3a1]/20 transition-colors';
  const labelClass = 'block text-[11.5px] font-medium text-[#374151] mb-1';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="공지 작성"
      size="md"
      footer={
        <>
          <Button variant="default" size="md" type="button" onClick={onClose} disabled={submitting}>
            취소
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            form="add-announcement-form"
            disabled={submitting || !title.trim() || !content.trim()}
          >
            {submitting ? '저장 중...' : publishNow ? '게시하기' : '임시저장'}
          </Button>
        </>
      }
    >
      <form id="add-announcement-form" onSubmit={handleSubmit} className="space-y-3.5">
        {/* 제목 */}
        <div>
          <label className={labelClass}>
            제목 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="공지 제목을 입력하세요"
            required
            className={inputClass}
          />
        </div>

        {/* 대상 반 */}
        <div>
          <label className={labelClass}>대상 반</label>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className={inputClass}
          >
            <option value="">전체 (모든 학생)</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <p className="text-[11px] text-[#9ca3af] mt-1">
            반을 선택하면 해당 반 학생·학부모에게만 표시됩니다.
          </p>
        </div>

        {/* 내용 */}
        <div>
          <label className={labelClass}>
            내용 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="공지 내용을 입력하세요"
            rows={6}
            required
            className={`${inputClass} resize-none`}
          />
        </div>

        {/* 옵션 */}
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="accent-[#4fc3a1]"
            />
            <span className="text-[12.5px] text-[#374151]">상단 고정</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={publishNow}
              onChange={(e) => setPublishNow(e.target.checked)}
              className="accent-[#4fc3a1]"
            />
            <span className="text-[12.5px] text-[#374151]">즉시 게시</span>
            <span className="text-[11px] text-[#9ca3af]">(체크 해제 시 임시저장)</span>
          </label>
        </div>
      </form>
    </Modal>
  );
}
