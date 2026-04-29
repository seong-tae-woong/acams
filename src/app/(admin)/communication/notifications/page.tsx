'use client';
import { useState, useEffect } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import Tabs from '@/components/shared/Tabs';
import { useCommunicationStore } from '@/lib/stores/communicationStore';
import { useStudentStore } from '@/lib/stores/studentStore';
import type { NotificationType, AnnouncementStatus, InquiryStatus, PublicInquiry } from '@/lib/types/notification';
import { INQUIRY_STATUS_LABEL, INQUIRY_STATUS_STYLE } from '@/lib/types/notification';
import { Send, Plus, Pin, Edit2, Phone, BookOpen, MessageSquare, Save } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { toast } from '@/lib/stores/toastStore';
import clsx from 'clsx';

const TYPE_STYLE: Record<NotificationType, { bg: string; text: string }> = {
  '공지':    { bg: '#E1F5EE', text: '#0D9E7A' },
  '출결알림': { bg: '#DBEAFE', text: '#1d4ed8' },
  '수납알림': { bg: '#FEF3C7', text: '#92400E' },
  '상담알림': { bg: '#EDE9FE', text: '#5B4FBE' },
  '일반':    { bg: '#f1f5f9', text: '#374151' },
};

const ANN_STATUS_STYLE: Record<AnnouncementStatus, { bg: string; text: string }> = {
  '게시됨':   { bg: '#D1FAE5', text: '#065f46' },
  '임시저장': { bg: '#FEF3C7', text: '#92400E' },
};

const TYPES: NotificationType[] = ['공지', '출결알림', '수납알림', '상담알림', '일반'];

const COMM_TABS = [
  { value: 'notifications', label: '학부모 알림' },
  { value: 'announcements', label: '공지사항' },
  { value: 'inquiries',     label: '문의사항' },
];

const INQ_STATUS_OPTIONS: InquiryStatus[] = ['NEW', 'READ', 'REPLIED'];

export default function NotificationsPage() {
  const {
    notifications, announcements, inquiries, loading,
    addNotification, fetchNotifications, fetchAnnouncements, fetchInquiries,
    updateInquiry,
  } = useCommunicationStore();
  const { students, fetchStudents } = useStudentStore();
  const [commTab, setCommTab] = useState('notifications');

  useEffect(() => {
    fetchNotifications();
    fetchAnnouncements();
    fetchInquiries();
    fetchStudents();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 알림 탭 ── */
  const [filter, setFilter] = useState<NotificationType | 'all'>('all');
  const [composing, setComposing] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState<NotificationType>('공지');

  const filtered = notifications.filter((n) => filter === 'all' || n.type === filter);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  /* ── 공지사항 탭 ── */
  const [selectedAnnId, setSelectedAnnId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedAnnId && announcements.length > 0) setSelectedAnnId(announcements[0].id);
  }, [announcements, selectedAnnId]);
  const [annStatusFilter, setAnnStatusFilter] = useState<AnnouncementStatus | 'all'>('all');

  const filteredAnn = announcements.filter((a) => annStatusFilter === 'all' || a.status === annStatusFilter);
  const selectedAnn = announcements.find((a) => a.id === selectedAnnId);

  const formatDate = (iso: string | null) => {
    if (!iso) return '-';
    return iso.slice(0, 10);
  };

  /* ── 문의사항 탭 ── */
  const [inqStatusFilter, setInqStatusFilter] = useState<InquiryStatus | 'all'>('all');
  const [selectedInqId, setSelectedInqId] = useState<string | null>(null);
  const [editMemo, setEditMemo] = useState('');
  const [editStatus, setEditStatus] = useState<InquiryStatus>('NEW');
  const [savingInq, setSavingInq] = useState(false);

  const filteredInq = inquiries.filter((inq) => inqStatusFilter === 'all' || inq.status === inqStatusFilter);
  const selectedInq: PublicInquiry | undefined = inquiries.find((inq) => inq.id === selectedInqId);

  // 문의 선택 시 편집 상태 초기화
  useEffect(() => {
    if (selectedInq) {
      setEditMemo(selectedInq.memo);
      setEditStatus(selectedInq.status);
      // 신규 문의를 열면 자동으로 '확인' 처리
      if (selectedInq.status === 'NEW') {
        updateInquiry(selectedInq.id, { status: 'READ' });
      }
    }
  }, [selectedInqId]); // eslint-disable-line react-hooks/exhaustive-deps

  const newCount = inquiries.filter((inq) => inq.status === 'NEW').length;

  const topbarBadge = () => {
    if (commTab === 'notifications') return `총 ${notifications.length}건`;
    if (commTab === 'announcements') return `${announcements.filter((a) => a.status === '게시됨').length}건 게시 중`;
    return `총 ${inquiries.length}건${newCount > 0 ? ` · 미확인 ${newCount}건` : ''}`;
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="알림 및 공지"
        badge={topbarBadge()}
        actions={
          commTab === 'notifications'
            ? <Button variant="dark" size="sm" onClick={() => setComposing(true)}><Plus size={13} /> 알림 작성</Button>
            : commTab === 'announcements'
            ? <Button variant="dark" size="sm" onClick={() => toast('공지 작성 기능은 추후 지원 예정입니다.', 'info')}><Plus size={13} /> 공지 작성</Button>
            : null
        }
      />

      <Tabs tabs={COMM_TABS} value={commTab} onChange={setCommTab} />

      {loading ? <LoadingSpinner /> : (
        <>
          {/* ── 학부모 알림 탭 ── */}
          {commTab === 'notifications' && (
            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setFilter('all')}
                    className={clsx(
                      'px-3 py-1.5 rounded-[8px] text-[12px] font-medium border transition-colors cursor-pointer',
                      filter === 'all' ? 'bg-[#1a2535] text-white border-transparent' : 'bg-white text-[#374151] border-[#e2e8f0] hover:bg-[#f4f6f8]',
                    )}
                  >
                    전체
                  </button>
                  {TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setFilter(t)}
                      className={clsx(
                        'px-3 py-1.5 rounded-[8px] text-[12px] font-medium border transition-colors cursor-pointer',
                        filter === t ? 'bg-[#1a2535] text-white border-transparent' : 'bg-white text-[#374151] border-[#e2e8f0] hover:bg-[#f4f6f8]',
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#e2e8f0]">
                    <span className="text-[12.5px] font-semibold text-[#111827]">발송 이력</span>
                  </div>
                  <div className="divide-y divide-[#f1f5f9]">
                    {filtered.map((n) => {
                      const ts = TYPE_STYLE[n.type];
                      const readRate = n.totalCount > 0 ? Math.round((n.readCount / n.totalCount) * 100) : 0;
                      return (
                        <div key={n.id} className="px-5 py-4 hover:bg-[#f9fafb]">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 rounded-[20px] text-[11px] font-medium" style={{ backgroundColor: ts.bg, color: ts.text }}>
                                  {n.type}
                                </span>
                                <span className="text-[11.5px] text-[#9ca3af]">{formatTime(n.sentAt)}</span>
                              </div>
                              <div className="text-[13px] font-semibold text-[#111827] mb-0.5">{n.title}</div>
                              <div className="text-[12px] text-[#6b7280] line-clamp-2">{n.content}</div>
                            </div>
                            <div className="ml-4 text-right shrink-0">
                              <div className="text-[12px] text-[#374151]">
                                <span className="font-semibold">{n.readCount}</span>/{n.totalCount}명 확인
                              </div>
                              <div className="mt-1 w-20 h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden ml-auto">
                                <div className="h-full bg-[#4fc3a1] rounded-full" style={{ width: `${readRate}%` }} />
                              </div>
                              <div className="text-[10.5px] text-[#9ca3af] mt-0.5">{readRate}%</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {composing && (
                <div className="w-80 shrink-0 border-l border-[#e2e8f0] bg-white overflow-y-auto p-4 space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-semibold text-[#111827]">알림 작성</span>
                    <button onClick={() => setComposing(false)} className="text-[#9ca3af] hover:text-[#374151] cursor-pointer text-[18px]">×</button>
                  </div>
                  <div>
                    <label className="text-[11.5px] text-[#6b7280] block mb-1">유형</label>
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value as NotificationType)}
                      className="w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-2.5 py-1.5 focus:outline-none cursor-pointer"
                    >
                      {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11.5px] text-[#6b7280] block mb-1">제목</label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="알림 제목"
                      className="w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-2.5 py-1.5 focus:outline-none focus:border-[#4fc3a1]"
                    />
                  </div>
                  <div>
                    <label className="text-[11.5px] text-[#6b7280] block mb-1">내용</label>
                    <textarea
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      placeholder="알림 내용을 입력하세요"
                      rows={5}
                      className="w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-2.5 py-1.5 focus:outline-none focus:border-[#4fc3a1] resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11.5px] text-[#6b7280] block mb-1">수신 대상</label>
                    <div className="p-2.5 bg-[#f4f6f8] rounded-[8px] text-[12px] text-[#374151]">
                      전체 학부모 ({students.filter((s) => s.status === '재원').length}명)
                    </div>
                  </div>
                  <Button
                    variant="dark"
                    size="md"
                    onClick={async () => {
                      if (!newTitle.trim() || !newContent.trim()) { toast('제목과 내용을 입력해주세요.', 'error'); return; }
                      const activeStudentIds = students.filter((s) => s.status === '재원').map((s) => s.id);
                      await addNotification({ type: newType, title: newTitle.trim(), content: newContent.trim(), recipients: activeStudentIds, sentBy: '' });
                      setComposing(false); setNewTitle(''); setNewContent('');
                    }}
                  >
                    <Send size={13} /> 발송
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ── 공지사항 탭 ── */}
          {commTab === 'announcements' && (
            <div className="flex flex-1 overflow-hidden">
              <div className="w-64 shrink-0 border-r border-[#e2e8f0] bg-white overflow-y-auto">
                <div className="p-2 border-b border-[#e2e8f0] flex gap-1.5">
                  {(['all', '게시됨', '임시저장'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setAnnStatusFilter(s)}
                      className={clsx(
                        'px-2.5 py-1 rounded-[6px] text-[11.5px] font-medium cursor-pointer transition-colors',
                        annStatusFilter === s ? 'bg-[#1a2535] text-white' : 'bg-[#f4f6f8] text-[#374151] hover:bg-[#e2e8f0]',
                      )}
                    >
                      {s === 'all' ? '전체' : s}
                    </button>
                  ))}
                </div>
                <div className="divide-y divide-[#f1f5f9]">
                  {filteredAnn.map((a) => {
                    const ss = ANN_STATUS_STYLE[a.status];
                    return (
                      <button
                        key={a.id}
                        onClick={() => setSelectedAnnId(a.id)}
                        className={clsx(
                          'w-full text-left px-3 py-3 transition-colors cursor-pointer',
                          selectedAnnId === a.id ? 'bg-[#E1F5EE]' : 'hover:bg-[#f4f6f8]',
                        )}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          {a.pinned && <Pin size={11} className="text-[#4fc3a1] shrink-0" />}
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: ss.bg, color: ss.text }}>
                            {a.status}
                          </span>
                        </div>
                        <div className="text-[12.5px] font-medium text-[#111827] line-clamp-2">{a.title}</div>
                        <div className="text-[11px] text-[#9ca3af] mt-0.5">{formatDate(a.publishedAt ?? a.createdAt)}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedAnn ? (
                <div className="flex-1 overflow-y-auto p-5">
                  <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-5 max-w-2xl">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {selectedAnn.pinned && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-[#E1F5EE] rounded text-[11px] text-[#065f46] font-medium">
                              <Pin size={10} /> 상단 고정
                            </span>
                          )}
                          <span
                            className="px-2 py-0.5 rounded text-[11px] font-medium"
                            style={{ backgroundColor: ANN_STATUS_STYLE[selectedAnn.status].bg, color: ANN_STATUS_STYLE[selectedAnn.status].text }}
                          >
                            {selectedAnn.status}
                          </span>
                        </div>
                        <h2 className="text-[16px] font-bold text-[#111827]">{selectedAnn.title}</h2>
                        <div className="text-[12px] text-[#6b7280] mt-1">
                          작성자: {selectedAnn.author} · 작성일: {formatDate(selectedAnn.createdAt)}
                          {selectedAnn.publishedAt && ` · 게시일: ${formatDate(selectedAnn.publishedAt)}`}
                        </div>
                        <div className="text-[12px] text-[#6b7280] mt-0.5">
                          대상: {selectedAnn.targetAudience.includes('all') ? '전체' : selectedAnn.targetAudience.join(', ')}
                          {selectedAnn.status === '게시됨' && ` · 읽음 ${selectedAnn.readCount}/${selectedAnn.totalCount}명`}
                        </div>
                      </div>
                      <Button variant="default" size="sm" onClick={() => toast('수정 기능은 추후 지원 예정입니다.', 'info')}><Edit2 size={12} /> 수정</Button>
                    </div>

                    <div className="border-t border-[#e2e8f0] pt-4">
                      <div className="text-[13px] text-[#374151] leading-relaxed whitespace-pre-line">
                        {selectedAnn.content}
                      </div>
                    </div>

                    {selectedAnn.attachments.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-[#e2e8f0]">
                        <div className="text-[12px] text-[#6b7280] mb-2">첨부파일</div>
                        {selectedAnn.attachments.map((att) => (
                          <div key={att.id} className="flex items-center gap-2 text-[12px] text-[#374151]">
                            <span>{att.fileName}</span>
                            <span className="text-[#9ca3af]">({(att.fileSize / 1024).toFixed(1)}KB)</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedAnn.status === '임시저장' && (
                      <div className="mt-4 pt-4 border-t border-[#e2e8f0] flex gap-2">
                        <Button variant="dark" size="md" onClick={() => toast('공지가 게시되었습니다.', 'success')}>게시하기</Button>
                        <Button variant="default" size="md" onClick={() => toast('임시저장 되었습니다.', 'info')}>저장</Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center bg-[#f4f6f8]">
                  <p className="text-[13px] text-[#9ca3af]">공지사항을 선택하세요</p>
                </div>
              )}
            </div>
          )}

          {/* ── 문의사항 탭 ── */}
          {commTab === 'inquiries' && (
            <div className="flex flex-1 overflow-hidden">
              {/* 좌측: 문의 목록 */}
              <div className="w-64 shrink-0 border-r border-[#e2e8f0] bg-white overflow-y-auto">
                {/* 상태 필터 */}
                <div className="p-2 border-b border-[#e2e8f0] flex gap-1.5 flex-wrap">
                  <button
                    onClick={() => setInqStatusFilter('all')}
                    className={clsx(
                      'px-2.5 py-1 rounded-[6px] text-[11.5px] font-medium cursor-pointer transition-colors',
                      inqStatusFilter === 'all' ? 'bg-[#1a2535] text-white' : 'bg-[#f4f6f8] text-[#374151] hover:bg-[#e2e8f0]',
                    )}
                  >
                    전체
                  </button>
                  {INQ_STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setInqStatusFilter(s)}
                      className={clsx(
                        'px-2.5 py-1 rounded-[6px] text-[11.5px] font-medium cursor-pointer transition-colors',
                        inqStatusFilter === s ? 'bg-[#1a2535] text-white' : 'bg-[#f4f6f8] text-[#374151] hover:bg-[#e2e8f0]',
                      )}
                    >
                      {INQUIRY_STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>

                {/* 목록 */}
                <div className="divide-y divide-[#f1f5f9]">
                  {filteredInq.length === 0 && (
                    <div className="px-4 py-8 text-center text-[12px] text-[#9ca3af]">
                      문의사항이 없습니다
                    </div>
                  )}
                  {filteredInq.map((inq) => {
                    const ss = INQUIRY_STATUS_STYLE[inq.status];
                    return (
                      <button
                        key={inq.id}
                        onClick={() => setSelectedInqId(inq.id)}
                        className={clsx(
                          'w-full text-left px-3 py-3 transition-colors cursor-pointer',
                          selectedInqId === inq.id ? 'bg-[#EEF2FF]' : 'hover:bg-[#f4f6f8]',
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                            style={{ backgroundColor: ss.bg, color: ss.text }}
                          >
                            {INQUIRY_STATUS_LABEL[inq.status]}
                          </span>
                          <span className="text-[10.5px] text-[#9ca3af]">
                            {new Date(inq.createdAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                          </span>
                        </div>
                        <div className="text-[13px] font-semibold text-[#111827]">{inq.name}</div>
                        <div className="text-[11.5px] text-[#6b7280] mt-0.5">{inq.phone}</div>
                        {inq.className && (
                          <div className="text-[11px] text-[#9ca3af] mt-0.5 truncate">{inq.className}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 우측: 문의 상세 */}
              {selectedInq ? (
                <div className="flex-1 overflow-y-auto p-5">
                  <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-5 max-w-2xl">
                    {/* 헤더 */}
                    <div className="flex items-start justify-between mb-5">
                      <div>
                        <h2 className="text-[16px] font-bold text-[#111827] mb-1">{selectedInq.name}</h2>
                        <div className="text-[12px] text-[#6b7280]">
                          접수일: {new Date(selectedInq.createdAt).toLocaleString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <span
                        className="px-2.5 py-1 rounded-[6px] text-[12px] font-semibold"
                        style={{ backgroundColor: INQUIRY_STATUS_STYLE[selectedInq.status].bg, color: INQUIRY_STATUS_STYLE[selectedInq.status].text }}
                      >
                        {INQUIRY_STATUS_LABEL[selectedInq.status]}
                      </span>
                    </div>

                    {/* 신청자 정보 */}
                    <div className="border border-[#e2e8f0] rounded-[10px] p-4 mb-4 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <Phone size={13} className="text-[#9ca3af] shrink-0" />
                        <span className="text-[12.5px] text-[#374151]">{selectedInq.phone}</span>
                      </div>
                      {selectedInq.className && (
                        <div className="flex items-center gap-2">
                          <BookOpen size={13} className="text-[#9ca3af] shrink-0" />
                          <span className="text-[12.5px] text-[#374151]">관심 수업: {selectedInq.className}</span>
                        </div>
                      )}
                      {selectedInq.message && (
                        <div className="flex items-start gap-2">
                          <MessageSquare size={13} className="text-[#9ca3af] shrink-0 mt-0.5" />
                          <p className="text-[12.5px] text-[#374151] leading-relaxed whitespace-pre-wrap">
                            {selectedInq.message}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* 상태 변경 + 메모 */}
                    <div className="border-t border-[#e2e8f0] pt-4 space-y-3">
                      <div>
                        <label className="text-[11.5px] font-semibold text-[#374151] block mb-1.5">처리 상태</label>
                        <div className="flex gap-2">
                          {INQ_STATUS_OPTIONS.map((s) => {
                            const ss = INQUIRY_STATUS_STYLE[s];
                            return (
                              <button
                                key={s}
                                onClick={() => setEditStatus(s)}
                                className={clsx(
                                  'px-3 py-1.5 rounded-[8px] text-[12px] font-medium border cursor-pointer transition-all',
                                  editStatus === s
                                    ? 'border-transparent'
                                    : 'bg-white text-[#6b7280] border-[#e2e8f0] hover:bg-[#f4f6f8]',
                                )}
                                style={editStatus === s ? { backgroundColor: ss.bg, color: ss.text, borderColor: 'transparent' } : {}}
                              >
                                {INQUIRY_STATUS_LABEL[s]}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="text-[11.5px] font-semibold text-[#374151] block mb-1.5">메모 (내부용)</label>
                        <textarea
                          value={editMemo}
                          onChange={(e) => setEditMemo(e.target.value)}
                          placeholder="상담 결과, 연락 내용 등을 기록하세요"
                          rows={4}
                          className="w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1] resize-none"
                        />
                      </div>

                      <Button
                        variant="dark"
                        size="md"
                        onClick={async () => {
                          setSavingInq(true);
                          await updateInquiry(selectedInq.id, { status: editStatus, memo: editMemo });
                          setSavingInq(false);
                        }}
                      >
                        {savingInq ? '저장 중...' : <><Save size={13} /> 저장</>}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[#f4f6f8]">
                  <MessageSquare size={32} className="text-[#d1d5db]" />
                  <p className="text-[13px] text-[#9ca3af]">
                    {filteredInq.length === 0 ? '아직 문의가 없습니다' : '문의를 선택하세요'}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
