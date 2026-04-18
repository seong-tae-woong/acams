'use client';
import { useState } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import { useClassStore } from '@/lib/stores/classStore';
import { Plus, BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';
import clsx from 'clsx';

// 더미 교재 데이터
const TEXTBOOKS = [
  { id: 'tb1', classId: 'c1', name: '개념수학 4학년 2학기', publisher: '천재교육', unit: '권', price: 18000, currentUnit: 3 },
  { id: 'tb2', classId: 'c1', name: '수학익힘 워크북 4학년', publisher: '미래엔', unit: '권', price: 12000, currentUnit: 1 },
  { id: 'tb3', classId: 'c2', name: '최상위수학 5학년', publisher: '디딤돌', unit: '권', price: 22000, currentUnit: 2 },
  { id: 'tb4', classId: 'c3', name: 'Phonics Monster 3', publisher: 'Happy House', unit: '권', price: 15000, currentUnit: 1 },
  { id: 'tb5', classId: 'c3', name: 'Word Starter Pack', publisher: '영어사', unit: '권', price: 10000, currentUnit: 1 },
  { id: 'tb6', classId: 'c4', name: 'Middle School English 1', publisher: 'YBM', unit: '권', price: 20000, currentUnit: 2 },
  { id: 'tb7', classId: 'c5', name: '개념수학 중1 (하)', publisher: '천재교육', unit: '권', price: 18000, currentUnit: 1 },
];

// 더미 커리큘럼 데이터 (주차별)
const CURRICULUM: Record<string, { week: number; topic: string; detail: string; done: boolean }[]> = {
  c1: [
    { week: 1, topic: '분수의 덧셈과 뺄셈 (1)', detail: '동분모 분수 덧셈, 진분수끼리의 합', done: true },
    { week: 2, topic: '분수의 덧셈과 뺄셈 (2)', detail: '이분모 분수 통분 후 계산', done: true },
    { week: 3, topic: '소수의 곱셈', detail: '소수 × 자연수, 자연수 × 소수', done: true },
    { week: 4, topic: '소수의 나눗셈 (1)', detail: '소수 ÷ 자연수 개념 및 연습', done: true },
    { week: 5, topic: '소수의 나눗셈 (2)', detail: '자연수 ÷ 소수, 소수 ÷ 소수', done: false },
    { week: 6, topic: '중간평가', detail: '1~5주차 범위 시험', done: false },
    { week: 7, topic: '넓이와 둘레', detail: '사각형·삼각형 넓이 공식', done: false },
    { week: 8, topic: '입체도형', detail: '직육면체, 정육면체 전개도', done: false },
  ],
  c2: [
    { week: 1, topic: '약수와 배수', detail: '공약수, 최대공약수 개념', done: true },
    { week: 2, topic: '공배수와 최소공배수', detail: '공배수 구하기 및 활용', done: true },
    { week: 3, topic: '분수의 곱셈', detail: '분수 × 분수, 대분수 곱셈', done: true },
    { week: 4, topic: '분수의 나눗셈', detail: '분수 ÷ 분수, 역수 개념', done: false },
    { week: 5, topic: '소수의 곱셈·나눗셈', detail: '복합 연산 응용 문제', done: false },
    { week: 6, topic: '중간평가', detail: '1~5주차 종합', done: false },
  ],
  c3: [
    { week: 1, topic: 'Alphabet & Phonics 기초', detail: 'A~Z 발음, 단모음·장모음', done: true },
    { week: 2, topic: 'CVC 단어', detail: 'cat, dog, hit 등 CVC 패턴', done: true },
    { week: 3, topic: 'Blends (br, cl, st...)', detail: '이중자음 발음 연습', done: true },
    { week: 4, topic: 'Digraphs (sh, ch, th)', detail: '겹자음 단어 읽기', done: false },
    { week: 5, topic: '단어 받아쓰기 테스트', detail: '1~4주차 단어 50개 시험', done: false },
    { week: 6, topic: 'Long Vowels', detail: 'a_e, i_e, o_e 패턴', done: false },
  ],
  c4: [
    { week: 1, topic: 'Present Simple vs. Continuous', detail: '현재 단순/진행 비교', done: true },
    { week: 2, topic: 'Past Tense', detail: '규칙/불규칙 과거 동사', done: true },
    { week: 3, topic: 'Future (will / be going to)', detail: '미래 표현 차이', done: false },
    { week: 4, topic: 'Modal Verbs (can, must, should)', detail: '조동사 의미와 활용', done: false },
  ],
  c5: [
    { week: 1, topic: '소인수분해', detail: '소수 판별, 소인수분해 표기', done: true },
    { week: 2, topic: '정수와 유리수', detail: '정수 개념, 수직선 표현', done: false },
    { week: 3, topic: '유리수의 사칙연산', detail: '덧셈·뺄셈·곱셈·나눗셈', done: false },
  ],
};

export default function CurriculumPage() {
  const { classes, selectedClassId, setSelectedClass } = useClassStore();
  const [activeTab, setActiveTab] = useState<'textbook' | 'curriculum'>('curriculum');
  const selected = classes.find((c) => c.id === selectedClassId);

  const textbooks = TEXTBOOKS.filter((t) => t.classId === selectedClassId);
  const curriculum = CURRICULUM[selectedClassId ?? ''] ?? [];
  const doneCount = curriculum.filter((c) => c.done).length;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="교재 및 커리큘럼"
        actions={<Button variant="dark" size="sm" onClick={() => toast('항목 추가 기능은 추후 지원 예정입니다.', 'info')}><Plus size={13} /> 항목 추가</Button>}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* 좌측: 반 선택 */}
        <div className="w-48 shrink-0 border-r border-[#e2e8f0] bg-white overflow-y-auto">
          {classes.map((cls) => (
            <button
              key={cls.id}
              onClick={() => setSelectedClass(cls.id)}
              className={clsx(
                'w-full px-3 py-3 border-b border-[#f1f5f9] text-left transition-colors cursor-pointer',
                selectedClassId === cls.id ? 'bg-[#E1F5EE]' : 'hover:bg-[#f4f6f8]',
              )}
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cls.color }} />
                <span className="text-[12.5px] font-medium text-[#111827] truncate">{cls.name}</span>
              </div>
              <div className="text-[11px] text-[#6b7280] mt-0.5 ml-4">{cls.teacherName}</div>
            </button>
          ))}
        </div>

        {/* 우측: 탭 + 내용 */}
        <div className="flex-1 overflow-y-auto">
          {selected ? (
            <>
              {/* 탭 헤더 */}
              <div className="bg-white border-b border-[#e2e8f0] px-5 flex items-center gap-4">
                {(['curriculum', 'textbook'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={clsx(
                      'py-3.5 text-[13px] font-medium border-b-2 transition-colors cursor-pointer',
                      activeTab === tab
                        ? 'border-[#4fc3a1] text-[#111827]'
                        : 'border-transparent text-[#6b7280] hover:text-[#374151]',
                    )}
                  >
                    {tab === 'curriculum' ? '커리큘럼' : '교재 목록'}
                  </button>
                ))}
              </div>

              <div className="p-5 space-y-4">
                {activeTab === 'curriculum' && (
                  <>
                    {/* 진도 요약 */}
                    <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4 flex items-center justify-between">
                      <div>
                        <span className="text-[14px] font-bold text-[#111827]">{selected.name}</span>
                        <span className="ml-2 text-[12px] text-[#6b7280]">주차별 커리큘럼</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-[12px] text-[#6b7280]">
                          진도 <span className="font-bold text-[#111827]">{doneCount}</span>/{curriculum.length}주차 완료
                        </div>
                        <div className="w-32 h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#4fc3a1] rounded-full"
                            style={{ width: curriculum.length > 0 ? `${Math.round((doneCount / curriculum.length) * 100)}%` : '0%' }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 주차별 목록 */}
                    <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
                      <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
                        <span className="text-[12.5px] font-semibold text-[#111827]">주차별 계획</span>
                      </div>
                      {curriculum.length === 0 ? (
                        <div className="p-8 text-center text-[13px] text-[#9ca3af]">커리큘럼을 등록하세요</div>
                      ) : (
                        <table className="w-full text-[12.5px]">
                          <thead>
                            <tr className="bg-[#f4f6f8]">
                              <th className="text-center px-4 py-2.5 text-[#6b7280] font-medium w-16">주차</th>
                              <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium">학습 주제</th>
                              <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium">세부 내용</th>
                              <th className="text-center px-4 py-2.5 text-[#6b7280] font-medium w-20">진행 상태</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#f1f5f9]">
                            {curriculum.map((row) => (
                              <tr key={row.week} className="hover:bg-[#f9fafb]">
                                <td className="px-4 py-3 text-center">
                                  <span className="w-7 h-7 rounded-full bg-[#f4f6f8] flex items-center justify-center text-[11.5px] font-semibold text-[#374151] mx-auto">
                                    {row.week}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-medium text-[#111827]">{row.topic}</td>
                                <td className="px-4 py-3 text-[#6b7280]">{row.detail}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className={clsx(
                                    'px-2.5 py-1 rounded-[20px] text-[11px] font-medium',
                                    row.done
                                      ? 'bg-[#D1FAE5] text-[#065f46]'
                                      : 'bg-[#f1f5f9] text-[#6b7280]',
                                  )}>
                                    {row.done ? '완료' : '예정'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </>
                )}

                {activeTab === 'textbook' && (
                  <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
                      <span className="text-[12.5px] font-semibold text-[#111827]">사용 교재</span>
                      <Button variant="default" size="sm" onClick={() => toast('교재 추가 기능은 추후 지원 예정입니다.', 'info')}><Plus size={12} /> 교재 추가</Button>
                    </div>
                    {textbooks.length === 0 ? (
                      <div className="p-8 text-center text-[13px] text-[#9ca3af]">등록된 교재가 없습니다</div>
                    ) : (
                      <div className="divide-y divide-[#f1f5f9]">
                        {textbooks.map((tb) => (
                          <div key={tb.id} className="px-5 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-[8px] bg-[#E1F5EE] flex items-center justify-center">
                                <BookOpen size={16} className="text-[#4fc3a1]" />
                              </div>
                              <div>
                                <div className="text-[13px] font-medium text-[#111827]">{tb.name}</div>
                                <div className="text-[11.5px] text-[#6b7280]">{tb.publisher} · {tb.price.toLocaleString()}원/{tb.unit}</div>
                              </div>
                            </div>
                            <div className="text-[12px] text-[#374151]">
                              현재 <span className="font-semibold text-[#4fc3a1]">{tb.currentUnit}권</span> 진행 중
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center h-full">
              <p className="text-[13px] text-[#9ca3af]">좌측에서 반을 선택하세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
