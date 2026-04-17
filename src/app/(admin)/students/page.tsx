'use client';
import { useState } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import Avatar from '@/components/shared/Avatar';
import Badge from '@/components/shared/Badge';
import SearchInput from '@/components/shared/SearchInput';
import FilterTags from '@/components/shared/FilterTags';
import Tabs from '@/components/shared/Tabs';
import { useStudentStore } from '@/lib/stores/studentStore';
import { useClassStore } from '@/lib/stores/classStore';
import { StudentStatus } from '@/lib/types/student';
import { formatKoreanDate, formatPhone } from '@/lib/utils/format';
import { Plus, Phone, School, Calendar, StickyNote, Users } from 'lucide-react';
import clsx from 'clsx';

const STATUS_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: StudentStatus.ACTIVE, label: '재원' },
  { value: StudentStatus.ON_LEAVE, label: '휴원' },
  { value: StudentStatus.WITHDRAWN, label: '퇴원' },
  { value: StudentStatus.WAITING, label: '대기' },
];

const DETAIL_TABS = [
  { value: 'info', label: '기본정보' },
  { value: 'class', label: '수강정보' },
  { value: 'attendance', label: '출결정보' },
  { value: 'grade', label: '성적정보' },
  { value: 'payment', label: '결제정보' },
  { value: 'consult', label: '상담정보' },
];

export default function StudentsPage() {
  const { students, selectedStudentId, filterStatus, search, getFilteredStudents, getStudent,
    setSelectedStudent, setFilterStatus, setSearch } = useStudentStore();
  const { classes } = useClassStore();
  const [detailTab, setDetailTab] = useState('info');

  const filtered = getFilteredStudents();
  const selected = selectedStudentId ? getStudent(selectedStudentId) : null;

  const statusCounts = STATUS_OPTIONS.slice(1).reduce<Record<string, number>>((acc, opt) => {
    acc[opt.value] = students.filter((s) => s.status === opt.value).length;
    return acc;
  }, {});

  const filterOptions = STATUS_OPTIONS.map((opt) => ({
    ...opt,
    count: opt.value === 'all' ? students.length : statusCounts[opt.value],
  }));

  const studentClasses = selected
    ? classes.filter((c) => selected.classes.includes(c.id))
    : [];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="학생 등록/정보 관리"
        badge={`총 ${students.filter(s => s.status === StudentStatus.ACTIVE).length}명 재원`}
        actions={
          <Button variant="dark" size="sm">
            <Plus size={13} /> 학생 등록
          </Button>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* 좌측 학생 목록 */}
        <div className="w-64 shrink-0 flex flex-col border-r border-[#e2e8f0] bg-white overflow-hidden">
          <div className="p-3 border-b border-[#e2e8f0] space-y-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="이름, 학교 검색"
              className="w-full"
            />
            <FilterTags
              options={filterOptions}
              value={filterStatus}
              onChange={(v) => setFilterStatus(v as StudentStatus | 'all')}
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-[12px] text-[#9ca3af]">검색 결과가 없습니다</div>
            ) : (
              filtered.map((student) => (
                <button
                  key={student.id}
                  onClick={() => { setSelectedStudent(student.id); setDetailTab('info'); }}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2.5 border-b border-[#f1f5f9] text-left transition-colors cursor-pointer',
                    selectedStudentId === student.id
                      ? 'bg-[#E1F5EE]'
                      : 'hover:bg-[#f4f6f8]',
                  )}
                >
                  <Avatar name={student.name} color={student.avatarColor} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[13px] font-medium text-[#111827] truncate">{student.name}</span>
                      <Badge label={student.status} />
                    </div>
                    <div className="text-[11px] text-[#6b7280] mt-0.5">
                      {student.school} · {student.grade}학년
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* 우측 상세 */}
        {selected ? (
          <div className="flex-1 flex flex-col overflow-hidden bg-[#f4f6f8]">
            {/* 헤더 */}
            <div className="bg-white border-b border-[#e2e8f0] px-5 py-4">
              <div className="flex items-center gap-4">
                <Avatar name={selected.name} color={selected.avatarColor} size="lg" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[17px] font-bold text-[#111827]">{selected.name}</span>
                    <Badge label={selected.status} />
                    <span className="text-[12px] text-[#9ca3af]">출결번호: {selected.attendanceNumber}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[12px] text-[#6b7280]">
                    <span className="flex items-center gap-1"><School size={12} />{selected.school} {selected.grade}학년</span>
                    <span className="flex items-center gap-1"><Phone size={12} />{formatPhone(selected.phone)}</span>
                    <span className="flex items-center gap-1"><Calendar size={12} />입원 {formatKoreanDate(selected.enrollDate)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="default" size="sm">정보 수정</Button>
                  <Button variant="dark" size="sm">상태 변경</Button>
                </div>
              </div>
            </div>

            {/* 탭 */}
            <Tabs tabs={DETAIL_TABS} value={detailTab} onChange={setDetailTab} className="bg-white px-5" />

            {/* 탭 내용 */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {detailTab === 'info' && (
                <div className="grid grid-cols-2 gap-4">
                  {/* 인적사항 */}
                  <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                    <div className="text-[12.5px] font-semibold text-[#111827] mb-3">인적사항</div>
                    <dl className="space-y-2">
                      {[
                        ['이름', selected.name],
                        ['학교', `${selected.school} ${selected.grade}학년`],
                        ['학생 연락처', formatPhone(selected.phone)],
                        ['보호자', selected.parentName],
                        ['보호자 연락처', formatPhone(selected.parentPhone)],
                        ['입원일', formatKoreanDate(selected.enrollDate)],
                      ].map(([label, value]) => (
                        <div key={label} className="flex">
                          <dt className="w-28 text-[12px] text-[#6b7280] shrink-0">{label}</dt>
                          <dd className="text-[12.5px] text-[#111827]">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  {/* 형제/자매 + 등록일 */}
                  <div className="space-y-4">
                    <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                      <div className="text-[12.5px] font-semibold text-[#111827] mb-2 flex items-center gap-1">
                        <Users size={13} /> 형제/자매
                      </div>
                      {selected.siblingIds.length === 0 ? (
                        <p className="text-[12px] text-[#9ca3af]">등록된 형제/자매 없음</p>
                      ) : (
                        selected.siblingIds.map((id) => {
                          const sibling = students.find((s) => s.id === id);
                          return sibling ? (
                            <div key={id} className="flex items-center gap-2 text-[12px]">
                              <Avatar name={sibling.name} color={sibling.avatarColor} size="sm" />
                              {sibling.name} ({sibling.school} {sibling.grade}학년)
                            </div>
                          ) : null;
                        })
                      )}
                    </div>

                    {/* 내부 메모 */}
                    <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                      <div className="text-[12.5px] font-semibold text-[#111827] mb-2 flex items-center gap-1">
                        <StickyNote size={13} /> 내부 메모 <span className="text-[10px] font-normal text-[#9ca3af]">(보호자 비공개)</span>
                      </div>
                      <textarea
                        defaultValue={selected.memo}
                        rows={4}
                        className="w-full text-[12px] border border-[#e2e8f0] rounded-[8px] p-2 resize-none focus:outline-none focus:border-[#4fc3a1] text-[#374151]"
                        placeholder="메모를 입력하세요..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'class' && (
                <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
                  <div className="text-[12.5px] font-semibold text-[#111827] mb-3">수강 중인 반</div>
                  {studentClasses.length === 0 ? (
                    <p className="text-[12px] text-[#9ca3af]">배정된 반 없음</p>
                  ) : (
                    <div className="space-y-2">
                      {studentClasses.map((cls) => (
                        <div key={cls.id} className="flex items-center justify-between p-3 bg-[#f4f6f8] rounded-[8px]">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cls.color }} />
                              <span className="text-[13px] font-medium text-[#111827]">{cls.name}</span>
                            </div>
                            <div className="text-[11.5px] text-[#6b7280] mt-0.5 ml-4">
                              {cls.teacherName} · {cls.schedule.map(s => `${['', '월', '화', '수', '목', '금', '토', '일'][s.dayOfWeek]}${s.startTime}`).join(', ')}
                            </div>
                          </div>
                          <span className="text-[12px] text-[#6b7280]">{cls.fee.toLocaleString()}원/월</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {(detailTab === 'attendance' || detailTab === 'grade' || detailTab === 'payment' || detailTab === 'consult') && (
                <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-8 text-center">
                  <p className="text-[13px] text-[#9ca3af]">해당 탭의 데이터를 불러오는 중...</p>
                  <p className="text-[12px] text-[#9ca3af] mt-1">좌측 메뉴에서 전용 화면을 이용하세요.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[#f4f6f8]">
            <p className="text-[13px] text-[#9ca3af]">좌측에서 학생을 선택하세요</p>
          </div>
        )}
      </div>
    </div>
  );
}
