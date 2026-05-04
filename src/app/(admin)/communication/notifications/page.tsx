'use client';
import { useState, useEffect, useRef } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import Tabs from '@/components/shared/Tabs';
import { useCommunicationStore } from '@/lib/stores/communicationStore';
import { useStudentStore } from '@/lib/stores/studentStore';
import { useClassStore } from '@/lib/stores/classStore';
import type { NotificationType, InquiryStatus, PublicInquiry } from '@/lib/types/notification';
import { INQUIRY_STATUS_LABEL, INQUIRY_STATUS_STYLE } from '@/lib/types/notification';
import { Send, Plus, Phone, BookOpen, MessageSquare, Save, LayoutTemplate, Users, GraduationCap, School, ChevronDown, Check } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { toast } from '@/lib/stores/toastStore';
import NotificationTemplateModal from '@/components/communication/NotificationTemplateModal';
import clsx from 'clsx';

const TYPE_STYLE: Record<NotificationType, { bg: string; text: string }> = {
  '공지':    { bg: '#E1F5EE', text: '#0D9E7A' },
  '출결알림': { bg: '#DBEAFE', text: '#1d4ed8' },
  '수납알림': { bg: '#FEF3C7', text: '#92400E' },
  '상담알림': { bg: '#EDE9FE', text: '#5B4FBE' },
  '일반':    { bg: '#f1f5f9', text: '#374151' },
};

const TYPES: NotificationType[] = ['공지', '출결알림', '수납알림', '상담알림', '일반'];
const INQ_STATUS_OPTIONS: InquiryStatus[] = ['NEW', 'READ', 'REPLIED'];

type RecipientMode = 'all' | 'class' | 'student';

const currentMonth = new Date().toISOString().slice(0, 7);

export default function NotificationsPage() {
  const {
    notifications, inquiries, loading,
    availableNotifMonths, availableInquiryMonths,
    addNotification, fetchNotifications, fetchInquiries,
    fetchAvailableNotifMonths, fetchAvailableInquiryMonths,
    updateInquiry, fetchTemplates,
  } = useCommunicationStore();
  const { students, fetchStudents } = useStudentStore();
  const { classes, fetchClasses } = useClassStore();
  const [commTab, setCommTab] = useState('notifications');

  useEffect(() => {
    fetchAvailableNotifMonths();
    fetchAvailableInquiryMonths();
    fetchNotifications(currentMonth);
    fetchInquiries(currentMonth);
    fetchStudents();
    fetchClasses();
    fetchTemplates();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 학부모 알림 탭 ── */
  const [filter, setFilter] = useState<NotificationType | 'all'>('all');
  const [notifMonth, setNotifMonth] = useState<string | null>(currentMonth);
  const [notifMonthDropOpen, setNotifMonthDropOpen] = useState(false);
  const notifMonthDropRef = useRef<HTMLDivElement>(null);
  const [selectedNotifId, setSelectedNotifId] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifMonthDropRef.current && !notifMonthDropRef.current.contains(e.target as Node))
        setNotifMonthDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectNotifMonth = (m: string | null) => {
    setNotifMonth(m);
    setNotifMonthDropOpen(false);
    setSelectedNotifId(null);
    fetchNotifications(m ?? undefined);
  };

  const notifMonthLabel = notifMonth
    ? `${notifMonth.slice(0, 4)}년 ${parseInt(notifMonth.slice(5, 7))}월`
    : '전체 월';

  // 첫 알림 자동 선택
  useEffect(() => {
    if (!selectedNotifId && notifications.length > 0) {
      setSelectedNotifId(notifications[0].id);
    }
  }, [notifications, selectedNotifId]);

  const filteredNotifs = notifications.filter((n) => filter === 'all' || n.type === filter);
  const selectedNotif = notifications.find((n) => n.id === selectedNotifId);

  /* ── 알림 작성 ── */
  const [composing, setComposing] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState<NotificationType>('공지');
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('all');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');

  const activeStudents = students.filter((s) => s.status === '재원');

  const computeRecipients = (): string[] => {
    if (recipientMode === 'all') return activeStudents.map((s) => s.id);
    if (recipientMode === 'class') {
      return activeStudents
        .filter((s) => s.classes.some((c) => selectedClassIds.includes(c)))
        .map((s) => s.id);
    }
    return selectedStudentIds;
  };

  const recipientCount = (() => {
    if (recipientMode === 'all') return activeStudents.length;
    if (recipientMode === 'class') {
      return activeStudents.filter((s) => s.classes.some((c) => selectedClassIds.includes(c))).length;
    }
    return selectedStudentIds.length;
  })();

  const toggleClass = (id: string) =>
    setSelectedClassIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const toggleStudent = (id: string) =>
    setSelectedStudentIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  /* ── 문의사항 탭 ── */
  const [inqStatusFilter, setInqStatusFilter] = useState<InquiryStatus | 'all'>('all');
  const [inqMonth, setInqMonth] = useState<string | null>(currentMonth);
  const [inqMonthDropOpen, setInqMonthDropOpen] = useState(false);
  const inqMonthDropRef = useRef<HTMLDivElement>(null);
  const [selectedInqId, setSelectedInqId] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inqMonthDropRef.current && !inqMonthDropRef.current.contains(e.target as Node))
        setInqMonthDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectInqMonth = (m: string | null) => {
    setInqMonth(m);
    setInqMonthDropOpen(false);
    setSelectedInqId(null);
    fetchInquiries(m ?? undefined);
  };

  const inqMonthLabel = inqMonth
    ? `${inqMonth.slice(0, 4)}년 ${parseInt(inqMonth.slice(5, 7))}월`
    : '전체 월';
  const [editMemo, setEditMemo] = useState('');
  const [editStatus, setEditStatus] = useState<InquiryStatus>('NEW');
  const [savingInq, setSavingInq] = useState(false);

  const filteredInq = inquiries.filter((inq) => inqStatusFilter === 'all' || inq.status === inqStatusFilter);
  const selectedInq: PublicInquiry | undefined = inquiries.find((inq) => inq.id === selectedInqId);
  const newCount = inquiries.filter((inq) => inq.status === 'NEW').length;

  useEffect(() => {
    if (selectedInq) {
      setEditMemo(selectedInq.memo);
      setEditStatus(selectedInq.status);
      if (selectedInq.status === 'NEW') updateInquiry(selectedInq.id, { status: 'READ' });
    }
  }, [selectedInqId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 탭 ── */
  const commTabs = [
    { value: 'notifications', label: '학부모 알림' },
    { value: 'inquiries', label: '문의사항', badge: newCount },
  ];

  const topbarBadge = () => {
    if (commTab === 'notifications') return `총 ${notifications.length}건`;
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
            : null
        }
      />

      <Tabs tabs={commTabs} value={commTab} onChange={setCommTab} />

      {loading ? <LoadingSpinner /> : (
        <>
          {/* ── 학부모 알림 탭 ── */}
          {commTab === 'notifications' && (
            <div className="flex flex-1 overflow-hidden">

              {/* 좌측: 알림 목록 */}
              <div className="w-64 shrink-0 border-r border-[#e2e8f0] bg-white flex flex-col overflow-hidden">
                {/* 유형 필터 */}
                <div className="p-2 border-b border-[#e2e8f0] flex gap-1 flex-wrap">
                  <button
                    onClick={() => setFilter('all')}
                    className={clsx('px-2 py-1 rounded-[6px] text-[11.5px] font-medium cursor-pointer transition-colors',
                      filter === 'all' ? 'bg-[#1a2535] text-white' : 'bg-[#f4f6f8] text-[#374151] hover:bg-[#e2e8f0]')}
                  >전체</button>
                  {TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setFilter(t)}
                      className={clsx('px-2 py-1 rounded-[6px] text-[11.5px] font-medium cursor-pointer transition-colors',
                        filter === t ? 'bg-[#1a2535] text-white' : 'bg-[#f4f6f8] text-[#374151] hover:bg-[#e2e8f0]')}
                    >{t}</button>
                  ))}
                </div>
                {/* 월 필터 */}
                <div className="px-2 py-1.5 border-b border-[#e2e8f0] relative" ref={notifMonthDropRef}>
                  <button
                    type="button"
                    onClick={() => setNotifMonthDropOpen((v) => !v)}
                    className="w-full text-[12px] border border-[#e2e8f0] rounded-[8px] px-2.5 py-1.5 flex items-center justify-between bg-white hover:bg-[#f9fafb] focus:outline-none cursor-pointer"
                  >
                    <span className="text-[#374151]">{notifMonthLabel}</span>
                    <ChevronDown size={12} className={clsx('text-[#6b7280] transition-transform', notifMonthDropOpen && 'rotate-180')} />
                  </button>
                  {notifMonthDropOpen && (
                    <div className="absolute top-full left-2 right-2 mt-1 bg-white border border-[#e2e8f0] rounded-[10px] shadow-lg z-20 py-1">
                      <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#f9fafb] cursor-pointer text-[12px] text-[#6b7280]" onClick={() => selectNotifMonth(null)}>
                        <Check size={12} className={clsx(notifMonth === null ? 'text-[#4fc3a1]' : 'invisible')} />전체 월
                      </div>
                      <div className="border-t border-[#f1f5f9] my-1" />
                      {availableNotifMonths.map((m) => (
                        <div key={m} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#f9fafb] cursor-pointer text-[12px] text-[#374151]" onClick={() => selectNotifMonth(m)}>
                          <Check size={12} className={clsx(notifMonth === m ? 'text-[#4fc3a1]' : 'invisible')} />
                          {m.slice(0, 4)}년 {parseInt(m.slice(5, 7))}월
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 목록 */}
                <div className="flex-1 overflow-y-auto divide-y divide-[#f1f5f9]">
                  {filteredNotifs.length === 0 && (
                    <div className="px-4 py-8 text-center text-[12px] text-[#9ca3af]">발송된 알림이 없습니다</div>
                  )}
                  {filteredNotifs.map((n) => {
                    const ts = TYPE_STYLE[n.type];
                    const readRate = n.totalCount > 0 ? Math.round((n.readCount / n.totalCount) * 100) : 0;
                    return (
                      <button
                        key={n.id}
                        onClick={() => setSelectedNotifId(n.id)}
                        className={clsx('w-full text-left px-3 py-3 transition-colors cursor-pointer',
                          selectedNotifId === n.id ? 'bg-[#E1F5EE]' : 'hover:bg-[#f4f6f8]')}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: ts.bg, color: ts.text }}>
                            {n.type}
                          </span>
                          <span className="text-[10.5px] text-[#9ca3af]">{formatTime(n.sentAt)}</span>
                        </div>
                        <div className="text-[12.5px] font-medium text-[#111827] line-clamp-2">{n.title}</div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <div className="flex-1 h-1 bg-[#f1f5f9] rounded-full overflow-hidden">
                            <div className="h-full bg-[#4fc3a1] rounded-full" style={{ width: `${readRate}%` }} />
                          </div>
                          <span className="text-[10.5px] text-[#9ca3af] shrink-0">{n.readCount}/{n.totalCount}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 중앙: 상세 */}
              {selectedNotif ? (() => {
                const ts = TYPE_STYLE[selectedNotif.type];
                const readRate = selectedNotif.totalCount > 0
                  ? Math.round((selectedNotif.readCount / selectedNotif.totalCount) * 100)
                  : 0;
                const recipientStudents = students.filter((s) => selectedNotif.recipients.includes(s.id));
                return (
                  <div className="flex-1 overflow-y-auto p-5">
                    <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-5 max-w-2xl">
                      {/* 헤더 */}
                      <div className="flex items-start gap-3 mb-4">
                        <span className="px-2 py-0.5 rounded-[20px] text-[11.5px] font-medium shrink-0 mt-0.5"
                          style={{ backgroundColor: ts.bg, color: ts.text }}>{selectedNotif.type}</span>
                        <div className="flex-1">
                          <h2 className="text-[16px] font-bold text-[#111827]">{selectedNotif.title}</h2>
                          <div className="text-[12px] text-[#9ca3af] mt-0.5">{formatTime(selectedNotif.sentAt)}</div>
                        </div>
                      </div>

                      {/* 내용 */}
                      <div className="border-t border-[#e2e8f0] pt-4 mb-4">
                        <p className="text-[13px] text-[#374151] leading-relaxed whitespace-pre-line">
                          {selectedNotif.content}
                        </p>
                      </div>

                      {/* 발송 현황 */}
                      <div className="border border-[#e2e8f0] rounded-[10px] p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[12.5px] font-semibold text-[#111827]">발송 현황</span>
                          <span className="text-[12px] text-[#374151]">
                            <span className="font-semibold text-[#4fc3a1]">{selectedNotif.readCount}</span>
                            /{selectedNotif.totalCount}명 확인 ({readRate}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-[#f1f5f9] rounded-full overflow-hidden mb-4">
                          <div className="h-full bg-[#4fc3a1] rounded-full transition-all" style={{ width: `${readRate}%` }} />
                        </div>

                        {/* 수신자 목록 */}
                        {recipientStudents.length > 0 && (
                          <div>
                            <div className="text-[11.5px] text-[#6b7280] mb-2">수신 대상 ({recipientStudents.length}명)</div>
                            <div className="flex flex-wrap gap-1.5">
                              {recipientStudents.map((s) => {
                                const read = selectedNotif.readRecipients?.includes(s.id);
                                return (
                                  <span key={s.id}
                                    className={`flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[11.5px] ${read ? 'bg-[#d1fae5] text-[#065f46]' : 'bg-[#f4f6f8] text-[#374151]'}`}>
                                    {read && (
                                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                                        <path d="M2 6l3 3 5-5" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                    )}
                                    {s.name}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })() : (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[#f4f6f8]">
                  <MessageSquare size={32} className="text-[#d1d5db]" />
                  <p className="text-[13px] text-[#9ca3af]">
                    {filteredNotifs.length === 0 ? '발송된 알림이 없습니다' : '알림을 선택하세요'}
                  </p>
                </div>
              )}

              {/* 우측: 알림 작성 패널 */}
              {composing && (
                <div className="w-80 shrink-0 border-l border-[#e2e8f0] bg-white overflow-y-auto p-4 space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-semibold text-[#111827]">알림 작성</span>
                    <button onClick={() => { setComposing(false); setRecipientMode('all'); setSelectedClassIds([]); setSelectedStudentIds([]); }}
                      className="text-[#9ca3af] hover:text-[#374151] cursor-pointer text-[18px]">×</button>
                  </div>

                  <div>
                    <label className="text-[11.5px] text-[#6b7280] block mb-1">유형</label>
                    <select value={newType} onChange={(e) => setNewType(e.target.value as NotificationType)}
                      className="w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-2.5 py-1.5 focus:outline-none cursor-pointer">
                      {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11.5px] text-[#6b7280] block mb-1">제목</label>
                    <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="알림 제목"
                      className="w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-2.5 py-1.5 focus:outline-none focus:border-[#4fc3a1]" />
                  </div>

                  <div>
                    <label className="text-[11.5px] text-[#6b7280] block mb-1">내용</label>
                    <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)}
                      placeholder="알림 내용을 입력하세요" rows={5}
                      className="w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-2.5 py-1.5 focus:outline-none focus:border-[#4fc3a1] resize-none" />
                  </div>

                  {/* 수신 대상 */}
                  <div>
                    <label className="text-[11.5px] text-[#6b7280] block mb-1.5">수신 대상</label>
                    <div className="flex gap-1 mb-2">
                      {([
                        { mode: 'all' as const, label: '전체', icon: <Users size={11} /> },
                        { mode: 'class' as const, label: '반 별', icon: <School size={11} /> },
                        { mode: 'student' as const, label: '학생 별', icon: <GraduationCap size={11} /> },
                      ]).map(({ mode, label, icon }) => (
                        <button key={mode} onClick={() => { setRecipientMode(mode); setSelectedClassIds([]); setSelectedStudentIds([]); }}
                          className={clsx(
                            'flex items-center gap-1 px-2.5 py-1 rounded-[6px] text-[11.5px] font-medium cursor-pointer transition-colors border flex-1 justify-center',
                            recipientMode === mode
                              ? 'bg-[#1a2535] text-white border-transparent'
                              : 'bg-white text-[#374151] border-[#e2e8f0] hover:bg-[#f4f6f8]'
                          )}>
                          {icon}{label}
                        </button>
                      ))}
                    </div>

                    {recipientMode === 'all' && (
                      <div className="p-2.5 bg-[#f4f6f8] rounded-[8px] text-[12px] text-[#374151]">
                        전체 학부모 ({activeStudents.length}명)
                      </div>
                    )}

                    {recipientMode === 'class' && (
                      <div className="border border-[#e2e8f0] rounded-[8px] max-h-40 overflow-y-auto">
                        {classes.length === 0 ? (
                          <div className="p-3 text-[12px] text-[#9ca3af] text-center">반이 없습니다</div>
                        ) : classes.map((cls) => {
                          const studentCount = activeStudents.filter((s) => s.classes.includes(cls.id)).length;
                          return (
                            <label key={cls.id} className="flex items-center gap-2 px-3 py-2 hover:bg-[#f4f6f8] cursor-pointer border-b border-[#f1f5f9] last:border-0">
                              <input type="checkbox" checked={selectedClassIds.includes(cls.id)}
                                onChange={() => toggleClass(cls.id)}
                                className="accent-[#4fc3a1] w-3.5 h-3.5" />
                              <span className="flex-1 text-[12px] text-[#374151]">{cls.name}</span>
                              <span className="text-[11px] text-[#9ca3af]">{studentCount}명</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {recipientMode === 'student' && (
                      <div className="border border-[#e2e8f0] rounded-[8px] overflow-hidden">
                        <input type="text" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)}
                          placeholder="학생 검색" className="w-full text-[12px] px-3 py-2 border-b border-[#e2e8f0] focus:outline-none" />
                        <div className="max-h-36 overflow-y-auto">
                          {activeStudents
                            .filter((s) => s.name.includes(studentSearch) || s.attendanceNumber?.includes(studentSearch))
                            .map((s) => (
                              <label key={s.id} className="flex items-center gap-2 px-3 py-2 hover:bg-[#f4f6f8] cursor-pointer border-b border-[#f1f5f9] last:border-0">
                                <input type="checkbox" checked={selectedStudentIds.includes(s.id)}
                                  onChange={() => toggleStudent(s.id)}
                                  className="accent-[#4fc3a1] w-3.5 h-3.5" />
                                <span className="flex-1 text-[12px] text-[#374151]">{s.name}</span>
                                <span className="text-[11px] text-[#9ca3af]">{s.classes.length > 0 ? classes.find((c) => c.id === s.classes[0])?.name ?? '' : ''}</span>
                              </label>
                            ))}
                        </div>
                      </div>
                    )}

                    {recipientMode !== 'all' && (
                      <div className="mt-1.5 text-[11.5px] text-[#6b7280]">
                        {recipientCount}명 선택됨
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button variant="default" size="md" onClick={() => setShowTemplateModal(true)}>
                      <LayoutTemplate size={13} /> 템플릿
                    </Button>
                    <Button variant="dark" size="md" onClick={async () => {
                      if (!newTitle.trim() || !newContent.trim()) { toast('제목과 내용을 입력해주세요.', 'error'); return; }
                      const recipients = computeRecipients();
                      if (recipients.length === 0) { toast('수신 대상을 선택해주세요.', 'error'); return; }
                      await addNotification({ type: newType, title: newTitle.trim(), content: newContent.trim(), recipients, sentBy: '' });
                      setComposing(false); setNewTitle(''); setNewContent(''); setRecipientMode('all'); setSelectedClassIds([]); setSelectedStudentIds([]);
                    }}>
                      <Send size={13} /> 발송
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 문의사항 탭 ── */}
          {commTab === 'inquiries' && (
            <div className="flex flex-1 overflow-hidden">
              <div className="w-64 shrink-0 border-r border-[#e2e8f0] bg-white overflow-y-auto">
                <div className="p-2 border-b border-[#e2e8f0] flex gap-1.5 flex-wrap">
                  <button onClick={() => setInqStatusFilter('all')}
                    className={clsx('px-2.5 py-1 rounded-[6px] text-[11.5px] font-medium cursor-pointer transition-colors',
                      inqStatusFilter === 'all' ? 'bg-[#1a2535] text-white' : 'bg-[#f4f6f8] text-[#374151] hover:bg-[#e2e8f0]')}>
                    전체
                  </button>
                  {INQ_STATUS_OPTIONS.map((s) => (
                    <button key={s} onClick={() => setInqStatusFilter(s)}
                      className={clsx('px-2.5 py-1 rounded-[6px] text-[11.5px] font-medium cursor-pointer transition-colors',
                        inqStatusFilter === s ? 'bg-[#1a2535] text-white' : 'bg-[#f4f6f8] text-[#374151] hover:bg-[#e2e8f0]')}>
                      {INQUIRY_STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
                {/* 월 필터 */}
                <div className="px-2 py-1.5 border-b border-[#e2e8f0] relative" ref={inqMonthDropRef}>
                  <button
                    type="button"
                    onClick={() => setInqMonthDropOpen((v) => !v)}
                    className="w-full text-[12px] border border-[#e2e8f0] rounded-[8px] px-2.5 py-1.5 flex items-center justify-between bg-white hover:bg-[#f9fafb] focus:outline-none cursor-pointer"
                  >
                    <span className="text-[#374151]">{inqMonthLabel}</span>
                    <ChevronDown size={12} className={clsx('text-[#6b7280] transition-transform', inqMonthDropOpen && 'rotate-180')} />
                  </button>
                  {inqMonthDropOpen && (
                    <div className="absolute top-full left-2 right-2 mt-1 bg-white border border-[#e2e8f0] rounded-[10px] shadow-lg z-20 py-1">
                      <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#f9fafb] cursor-pointer text-[12px] text-[#6b7280]" onClick={() => selectInqMonth(null)}>
                        <Check size={12} className={clsx(inqMonth === null ? 'text-[#4fc3a1]' : 'invisible')} />전체 월
                      </div>
                      <div className="border-t border-[#f1f5f9] my-1" />
                      {availableInquiryMonths.map((m) => (
                        <div key={m} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#f9fafb] cursor-pointer text-[12px] text-[#374151]" onClick={() => selectInqMonth(m)}>
                          <Check size={12} className={clsx(inqMonth === m ? 'text-[#4fc3a1]' : 'invisible')} />
                          {m.slice(0, 4)}년 {parseInt(m.slice(5, 7))}월
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="divide-y divide-[#f1f5f9]">
                  {filteredInq.length === 0 && (
                    <div className="px-4 py-8 text-center text-[12px] text-[#9ca3af]">문의사항이 없습니다</div>
                  )}
                  {filteredInq.map((inq) => {
                    const ss = INQUIRY_STATUS_STYLE[inq.status];
                    return (
                      <button key={inq.id} onClick={() => setSelectedInqId(inq.id)}
                        className={clsx('w-full text-left px-3 py-3 transition-colors cursor-pointer',
                          selectedInqId === inq.id ? 'bg-[#EEF2FF]' : 'hover:bg-[#f4f6f8]')}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                            style={{ backgroundColor: ss.bg, color: ss.text }}>
                            {INQUIRY_STATUS_LABEL[inq.status]}
                          </span>
                          <span className="text-[10.5px] text-[#9ca3af]">
                            {new Date(inq.createdAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                          </span>
                        </div>
                        <div className="text-[13px] font-semibold text-[#111827]">{inq.name}</div>
                        <div className="text-[11.5px] text-[#6b7280] mt-0.5">{inq.phone}</div>
                        {inq.className && <div className="text-[11px] text-[#9ca3af] mt-0.5 truncate">{inq.className}</div>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedInq ? (
                <div className="flex-1 overflow-y-auto p-5">
                  <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-5 max-w-2xl">
                    <div className="flex items-start justify-between mb-5">
                      <div>
                        <h2 className="text-[16px] font-bold text-[#111827] mb-1">{selectedInq.name}</h2>
                        <div className="text-[12px] text-[#6b7280]">
                          접수일: {new Date(selectedInq.createdAt).toLocaleString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-[6px] text-[12px] font-semibold"
                        style={{ backgroundColor: INQUIRY_STATUS_STYLE[selectedInq.status].bg, color: INQUIRY_STATUS_STYLE[selectedInq.status].text }}>
                        {INQUIRY_STATUS_LABEL[selectedInq.status]}
                      </span>
                    </div>

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
                          <p className="text-[12.5px] text-[#374151] leading-relaxed whitespace-pre-wrap">{selectedInq.message}</p>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-[#e2e8f0] pt-4 space-y-3">
                      <div>
                        <label className="text-[11.5px] font-semibold text-[#374151] block mb-1.5">처리 상태</label>
                        <div className="flex gap-2">
                          {INQ_STATUS_OPTIONS.map((s) => {
                            const ss = INQUIRY_STATUS_STYLE[s];
                            return (
                              <button key={s} onClick={() => setEditStatus(s)}
                                className={clsx('px-3 py-1.5 rounded-[8px] text-[12px] font-medium border cursor-pointer transition-all',
                                  editStatus === s ? 'border-transparent' : 'bg-white text-[#6b7280] border-[#e2e8f0] hover:bg-[#f4f6f8]')}
                                style={editStatus === s ? { backgroundColor: ss.bg, color: ss.text } : {}}>
                                {INQUIRY_STATUS_LABEL[s]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <label className="text-[11.5px] font-semibold text-[#374151] block mb-1.5">메모 (내부용)</label>
                        <textarea value={editMemo} onChange={(e) => setEditMemo(e.target.value)}
                          placeholder="상담 결과, 연락 내용 등을 기록하세요" rows={4}
                          className="w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1] resize-none" />
                      </div>
                      <Button variant="dark" size="md" onClick={async () => {
                        setSavingInq(true);
                        await updateInquiry(selectedInq.id, { status: editStatus, memo: editMemo });
                        setSavingInq(false);
                      }}>
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

      {showTemplateModal && (
        <NotificationTemplateModal
          onClose={() => setShowTemplateModal(false)}
          onApply={(t) => {
            setNewType(t.category as NotificationType);
            setNewTitle(t.title);
            setNewContent(t.content);
          }}
        />
      )}
    </div>
  );
}
