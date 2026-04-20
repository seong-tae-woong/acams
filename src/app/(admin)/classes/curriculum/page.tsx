'use client';
import { useState } from 'react';
import Topbar from '@/components/admin/Topbar';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import { useClassStore } from '@/lib/stores/classStore';
import { Plus, BookOpen, Minus, Pencil, X } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';
import clsx from 'clsx';

// ── 타입 ─────────────────────────────────────────────────
interface Textbook {
  id: string;
  classId: string;
  name: string;
  publisher: string;
  unit: string;        // 권/세트 등
  totalUnits: number;  // 총 권수
  price: number;       // 권당 가격
  currentUnit: number; // 현재 진행 권
  isbn: string;
  purchaseDate: string; // YYYY-MM-DD
  memo: string;
}

interface CurriculumRow {
  week: number;
  topic: string;
  detail: string;
  done: boolean;
}

// ── 초기 데이터 ───────────────────────────────────────────
const INITIAL_TEXTBOOKS: Textbook[] = [
  { id: 'tb1', classId: 'c1', name: '개념수학 4학년 2학기', publisher: '천재교육', unit: '권', totalUnits: 1, price: 18000, currentUnit: 1, isbn: '979-11-234-5678-1', purchaseDate: '2026-03-01', memo: '학기 시작 시 일괄 구매' },
  { id: 'tb2', classId: 'c1', name: '수학익힘 워크북 4학년', publisher: '미래엔', unit: '권', totalUnits: 1, price: 12000, currentUnit: 1, isbn: '979-11-987-6543-2', purchaseDate: '2026-03-01', memo: '' },
  { id: 'tb3', classId: 'c2', name: '최상위수학 5학년', publisher: '디딤돌', unit: '권', totalUnits: 2, price: 22000, currentUnit: 1, isbn: '979-11-111-2222-3', purchaseDate: '2026-03-05', memo: '상·하 2권 세트' },
  { id: 'tb4', classId: 'c3', name: 'Phonics Monster 3', publisher: 'Happy House', unit: '권', totalUnits: 6, price: 15000, currentUnit: 3, isbn: '978-89-5605-001-3', purchaseDate: '2026-03-01', memo: '시리즈 1~6권 중 3권 진행' },
  { id: 'tb5', classId: 'c3', name: 'Word Starter Pack', publisher: '영어사', unit: '권', totalUnits: 1, price: 10000, currentUnit: 1, isbn: '', purchaseDate: '2026-03-01', memo: '단어 암기용 보조 교재' },
  { id: 'tb6', classId: 'c4', name: 'Middle School English 1', publisher: 'YBM', unit: '권', totalUnits: 1, price: 20000, currentUnit: 1, isbn: '978-89-7085-101-6', purchaseDate: '2026-03-01', memo: '' },
  { id: 'tb7', classId: 'c5', name: '개념수학 중1 (하)', publisher: '천재교육', unit: '권', totalUnits: 1, price: 18000, currentUnit: 1, isbn: '979-11-234-9900-7', purchaseDate: '2026-03-01', memo: '중1 하반기 과정' },
];

const INITIAL_CURRICULUM: Record<string, CurriculumRow[]> = {
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

const fieldCls = 'w-full text-[12.5px] border border-[#e2e8f0] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#4fc3a1]';

export default function CurriculumPage() {
  const { classes, selectedClassId, setSelectedClass } = useClassStore();
  const [activeTab, setActiveTab] = useState<'textbook' | 'curriculum'>('curriculum');
  const selected = classes.find((c) => c.id === selectedClassId);

  // ── 상태 ──────────────────────────────────────────────
  const [textbooks, setTextbooks] = useState<Textbook[]>(INITIAL_TEXTBOOKS);
  const [curriculum, setCurriculum] = useState<Record<string, CurriculumRow[]>>(INITIAL_CURRICULUM);

  const classTextbooks = textbooks.filter((t) => t.classId === selectedClassId);
  const classCurriculum = curriculum[selectedClassId ?? ''] ?? [];
  const doneCount = classCurriculum.filter((c) => c.done).length;

  // ── 커리큘럼: 진행 상태 토글 ──────────────────────────
  const toggleDone = (week: number) => {
    if (!selectedClassId) return;
    setCurriculum((prev) => ({
      ...prev,
      [selectedClassId]: prev[selectedClassId].map((row) =>
        row.week === week ? { ...row, done: !row.done } : row,
      ),
    }));
  };

  // ── 커리큘럼: 항목 추가 모달 ─────────────────────────
  const [addCurrOpen, setAddCurrOpen] = useState(false);
  const [currForm, setCurrForm] = useState({ topic: '', detail: '' });

  const handleAddCurriculum = () => {
    if (!selectedClassId) return;
    if (!currForm.topic.trim()) { toast('학습 주제를 입력해주세요.', 'error'); return; }
    const existing = curriculum[selectedClassId] ?? [];
    const nextWeek = existing.length > 0 ? Math.max(...existing.map((r) => r.week)) + 1 : 1;
    setCurriculum((prev) => ({
      ...prev,
      [selectedClassId]: [...(prev[selectedClassId] ?? []), { week: nextWeek, topic: currForm.topic.trim(), detail: currForm.detail.trim(), done: false }],
    }));
    toast(`${nextWeek}주차 커리큘럼이 추가되었습니다.`, 'success');
    setCurrForm({ topic: '', detail: '' });
    setAddCurrOpen(false);
  };

  // ── 교재: 현재 권 수 조정 ─────────────────────────────
  const updateCurrentUnit = (id: string, delta: number) => {
    setTextbooks((prev) =>
      prev.map((tb) =>
        tb.id === id
          ? { ...tb, currentUnit: Math.min(tb.totalUnits, Math.max(1, tb.currentUnit + delta)) }
          : tb,
      ),
    );
  };

  // ── 교재: 상세 팝업 ───────────────────────────────────
  const [detailBook, setDetailBook] = useState<Textbook | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [detailForm, setDetailForm] = useState<Textbook | null>(null);

  const openDetail = (tb: Textbook) => {
    setDetailBook(tb);
    setDetailForm({ ...tb });
    setEditMode(false);
  };

  const handleSaveDetail = () => {
    if (!detailForm) return;
    if (!detailForm.name.trim()) { toast('교재명을 입력해주세요.', 'error'); return; }
    setTextbooks((prev) => prev.map((tb) => tb.id === detailForm.id ? { ...detailForm } : tb));
    setDetailBook({ ...detailForm });
    setEditMode(false);
    toast('교재 정보가 수정되었습니다.', 'success');
  };

  // ── 교재: 추가 모달 ───────────────────────────────────
  const [addTbOpen, setAddTbOpen] = useState(false);
  const [tbForm, setTbForm] = useState({
    name: '', publisher: '', unit: '권', totalUnits: '', price: '', currentUnit: '1', isbn: '', purchaseDate: '', memo: '',
  });

  const handleAddTextbook = () => {
    if (!selectedClassId) return;
    if (!tbForm.name.trim()) { toast('교재명을 입력해주세요.', 'error'); return; }
    const newTb: Textbook = {
      id: `tb${Date.now()}`,
      classId: selectedClassId,
      name: tbForm.name.trim(),
      publisher: tbForm.publisher.trim(),
      unit: tbForm.unit.trim() || '권',
      totalUnits: parseInt(tbForm.totalUnits) || 1,
      price: parseInt(tbForm.price) || 0,
      currentUnit: parseInt(tbForm.currentUnit) || 1,
      isbn: tbForm.isbn.trim(),
      purchaseDate: tbForm.purchaseDate,
      memo: tbForm.memo.trim(),
    };
    setTextbooks((prev) => [...prev, newTb]);
    toast(`'${newTb.name}' 교재가 추가되었습니다.`, 'success');
    setTbForm({ name: '', publisher: '', unit: '권', totalUnits: '', price: '', currentUnit: '1', isbn: '', purchaseDate: '', memo: '' });
    setAddTbOpen(false);
  };

  // ── 항목 추가 버튼 (탭별 분기) ────────────────────────
  const handleTopbarAdd = () => {
    if (activeTab === 'curriculum') {
      if (!selectedClassId) { toast('먼저 반을 선택해주세요.', 'error'); return; }
      setCurrForm({ topic: '', detail: '' });
      setAddCurrOpen(true);
    } else {
      if (!selectedClassId) { toast('먼저 반을 선택해주세요.', 'error'); return; }
      setTbForm({ name: '', publisher: '', unit: '권', totalUnits: '', price: '', currentUnit: '1', isbn: '', purchaseDate: '', memo: '' });
      setAddTbOpen(true);
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="교재 및 커리큘럼"
        actions={
          <Button variant="dark" size="sm" onClick={handleTopbarAdd}>
            <Plus size={13} /> 항목 추가
          </Button>
        }
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
                {/* ── 커리큘럼 탭 ─────────────────────────── */}
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
                          진도 <span className="font-bold text-[#111827]">{doneCount}</span>/{classCurriculum.length}주차 완료
                        </div>
                        <div className="w-32 h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#4fc3a1] rounded-full transition-all"
                            style={{ width: classCurriculum.length > 0 ? `${Math.round((doneCount / classCurriculum.length) * 100)}%` : '0%' }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 주차별 목록 */}
                    <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
                      <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
                        <span className="text-[12.5px] font-semibold text-[#111827]">주차별 계획</span>
                        <button
                          onClick={() => { setCurrForm({ topic: '', detail: '' }); setAddCurrOpen(true); }}
                          className="flex items-center gap-1 text-[11.5px] text-[#4fc3a1] hover:text-[#38a387] font-medium cursor-pointer"
                        >
                          <Plus size={12} /> 주차 추가
                        </button>
                      </div>
                      {classCurriculum.length === 0 ? (
                        <div className="p-8 text-center text-[13px] text-[#9ca3af]">커리큘럼을 등록하세요</div>
                      ) : (
                        <table className="w-full text-[12.5px]">
                          <thead>
                            <tr className="bg-[#f4f6f8]">
                              <th className="text-center px-4 py-2.5 text-[#6b7280] font-medium w-16">주차</th>
                              <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium">학습 주제</th>
                              <th className="text-left px-4 py-2.5 text-[#6b7280] font-medium">세부 내용</th>
                              <th className="text-center px-4 py-2.5 text-[#6b7280] font-medium w-24">진행 상태</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#f1f5f9]">
                            {classCurriculum.map((row) => (
                              <tr key={row.week} className="hover:bg-[#f9fafb]">
                                <td className="px-4 py-3 text-center">
                                  <span className="w-7 h-7 rounded-full bg-[#f4f6f8] flex items-center justify-center text-[11.5px] font-semibold text-[#374151] mx-auto">
                                    {row.week}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-medium text-[#111827]">{row.topic}</td>
                                <td className="px-4 py-3 text-[#6b7280]">{row.detail}</td>
                                <td className="px-4 py-3 text-center">
                                  <button
                                    onClick={() => toggleDone(row.week)}
                                    title="클릭하여 상태 변경"
                                    className={clsx(
                                      'px-2.5 py-1 rounded-[20px] text-[11px] font-medium transition-colors cursor-pointer',
                                      row.done
                                        ? 'bg-[#D1FAE5] text-[#065f46] hover:bg-[#A7F3D0]'
                                        : 'bg-[#f1f5f9] text-[#6b7280] hover:bg-[#e2e8f0]',
                                    )}
                                  >
                                    {row.done ? '완료' : '예정'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </>
                )}

                {/* ── 교재 목록 탭 ────────────────────────── */}
                {activeTab === 'textbook' && (
                  <div className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
                      <span className="text-[12.5px] font-semibold text-[#111827]">사용 교재</span>
                      <Button variant="default" size="sm" onClick={() => {
                        setTbForm({ name: '', publisher: '', unit: '권', totalUnits: '', price: '', currentUnit: '1', isbn: '', purchaseDate: '', memo: '' });
                        setAddTbOpen(true);
                      }}>
                        <Plus size={12} /> 교재 추가
                      </Button>
                    </div>
                    {classTextbooks.length === 0 ? (
                      <div className="p-8 text-center text-[13px] text-[#9ca3af]">등록된 교재가 없습니다</div>
                    ) : (
                      <div className="divide-y divide-[#f1f5f9]">
                        {classTextbooks.map((tb) => (
                          <div
                            key={tb.id}
                            className="px-5 py-4 flex items-center justify-between hover:bg-[#f9fafb] transition-colors"
                          >
                            {/* 교재 기본 정보 — 클릭 시 상세 팝업 */}
                            <button
                              onClick={() => openDetail(tb)}
                              className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
                            >
                              <div className="w-9 h-9 rounded-[8px] bg-[#E1F5EE] flex items-center justify-center shrink-0">
                                <BookOpen size={16} className="text-[#4fc3a1]" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-[13px] font-medium text-[#111827] truncate">{tb.name}</div>
                                <div className="text-[11.5px] text-[#6b7280]">{tb.publisher} · {tb.price.toLocaleString()}원/{tb.unit}</div>
                              </div>
                            </button>

                            {/* 현재 권 수 조정 */}
                            <div className="flex items-center gap-2 shrink-0 ml-4">
                              <button
                                onClick={() => updateCurrentUnit(tb.id, -1)}
                                disabled={tb.currentUnit <= 1}
                                className="w-6 h-6 rounded-full border border-[#e2e8f0] flex items-center justify-center text-[#6b7280] hover:border-[#4fc3a1] hover:text-[#4fc3a1] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                              >
                                <Minus size={11} />
                              </button>
                              <span className="text-[12px] text-[#374151] w-16 text-center">
                                <span className="font-semibold text-[#4fc3a1]">{tb.currentUnit}</span>
                                {tb.totalUnits > 1 && <span className="text-[#9ca3af]">/{tb.totalUnits}</span>}
                                {tb.unit} 진행
                              </span>
                              <button
                                onClick={() => updateCurrentUnit(tb.id, 1)}
                                disabled={tb.currentUnit >= tb.totalUnits}
                                className="w-6 h-6 rounded-full border border-[#e2e8f0] flex items-center justify-center text-[#6b7280] hover:border-[#4fc3a1] hover:text-[#4fc3a1] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                              >
                                <Plus size={11} />
                              </button>
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

      {/* ── 커리큘럼 항목 추가 모달 ──────────────────────── */}
      <Modal
        open={addCurrOpen}
        onClose={() => setAddCurrOpen(false)}
        title="커리큘럼 주차 추가"
        size="sm"
        footer={
          <>
            <Button variant="default" size="md" onClick={() => setAddCurrOpen(false)}>취소</Button>
            <Button variant="dark" size="md" onClick={handleAddCurriculum}>추가</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">학습 주제 *</label>
            <input
              className={fieldCls}
              value={currForm.topic}
              onChange={(e) => setCurrForm((f) => ({ ...f, topic: e.target.value }))}
              placeholder="예: 분수의 덧셈과 뺄셈"
            />
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">세부 내용</label>
            <textarea
              className={fieldCls + ' resize-none'}
              rows={3}
              value={currForm.detail}
              onChange={(e) => setCurrForm((f) => ({ ...f, detail: e.target.value }))}
              placeholder="예: 동분모 분수 덧셈, 진분수끼리의 합"
            />
          </div>
          <div className="text-[11.5px] text-[#9ca3af]">
            * 주차 번호는 자동으로 {(curriculum[selectedClassId ?? ''] ?? []).length + 1}주차로 지정됩니다.
          </div>
        </div>
      </Modal>

      {/* ── 교재 추가 모달 ───────────────────────────────── */}
      <Modal
        open={addTbOpen}
        onClose={() => setAddTbOpen(false)}
        title="교재 추가"
        size="sm"
        footer={
          <>
            <Button variant="default" size="md" onClick={() => setAddTbOpen(false)}>취소</Button>
            <Button variant="dark" size="md" onClick={handleAddTextbook}>추가</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">교재명 *</label>
            <input className={fieldCls} value={tbForm.name} onChange={(e) => setTbForm((f) => ({ ...f, name: e.target.value }))} placeholder="예: 개념수학 5학년" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">출판사</label>
              <input className={fieldCls} value={tbForm.publisher} onChange={(e) => setTbForm((f) => ({ ...f, publisher: e.target.value }))} placeholder="예: 천재교육" />
            </div>
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">가격 (원)</label>
              <input type="number" className={fieldCls} value={tbForm.price} onChange={(e) => setTbForm((f) => ({ ...f, price: e.target.value }))} placeholder="예: 18000" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">단위</label>
              <input className={fieldCls} value={tbForm.unit} onChange={(e) => setTbForm((f) => ({ ...f, unit: e.target.value }))} placeholder="권" />
            </div>
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">총 권수</label>
              <input type="number" className={fieldCls} value={tbForm.totalUnits} onChange={(e) => setTbForm((f) => ({ ...f, totalUnits: e.target.value }))} placeholder="예: 2" min={1} />
            </div>
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">현재 권</label>
              <input type="number" className={fieldCls} value={tbForm.currentUnit} onChange={(e) => setTbForm((f) => ({ ...f, currentUnit: e.target.value }))} placeholder="1" min={1} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">ISBN</label>
              <input className={fieldCls} value={tbForm.isbn} onChange={(e) => setTbForm((f) => ({ ...f, isbn: e.target.value }))} placeholder="978-..." />
            </div>
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">구입일</label>
              <input type="date" className={fieldCls} value={tbForm.purchaseDate} onChange={(e) => setTbForm((f) => ({ ...f, purchaseDate: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-[11.5px] text-[#6b7280] block mb-1">메모</label>
            <input className={fieldCls} value={tbForm.memo} onChange={(e) => setTbForm((f) => ({ ...f, memo: e.target.value }))} placeholder="예: 상·하 2권 세트" />
          </div>
        </div>
      </Modal>

      {/* ── 교재 상세 팝업 ───────────────────────────────── */}
      <Modal
        open={!!detailBook}
        onClose={() => { setDetailBook(null); setEditMode(false); }}
        title={editMode ? '교재 정보 수정' : '교재 상세 정보'}
        size="sm"
        footer={
          editMode ? (
            <>
              <Button variant="default" size="md" onClick={() => { setEditMode(false); setDetailForm(detailBook ? { ...detailBook } : null); }}>취소</Button>
              <Button variant="dark" size="md" onClick={handleSaveDetail}>저장</Button>
            </>
          ) : (
            <>
              <Button variant="default" size="md" onClick={() => setDetailBook(null)}>닫기</Button>
              <Button variant="primary" size="md" onClick={() => setEditMode(true)}>
                <Pencil size={12} /> 수정
              </Button>
            </>
          )
        }
      >
        {detailBook && detailForm && (
          <div className="space-y-3">
            {editMode ? (
              /* 수정 폼 */
              <>
                <div>
                  <label className="text-[11.5px] text-[#6b7280] block mb-1">교재명 *</label>
                  <input className={fieldCls} value={detailForm.name} onChange={(e) => setDetailForm((f) => f ? { ...f, name: e.target.value } : f)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11.5px] text-[#6b7280] block mb-1">출판사</label>
                    <input className={fieldCls} value={detailForm.publisher} onChange={(e) => setDetailForm((f) => f ? { ...f, publisher: e.target.value } : f)} />
                  </div>
                  <div>
                    <label className="text-[11.5px] text-[#6b7280] block mb-1">가격 (원)</label>
                    <input type="number" className={fieldCls} value={detailForm.price} onChange={(e) => setDetailForm((f) => f ? { ...f, price: parseInt(e.target.value) || 0 } : f)} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11.5px] text-[#6b7280] block mb-1">단위</label>
                    <input className={fieldCls} value={detailForm.unit} onChange={(e) => setDetailForm((f) => f ? { ...f, unit: e.target.value } : f)} />
                  </div>
                  <div>
                    <label className="text-[11.5px] text-[#6b7280] block mb-1">총 권수</label>
                    <input type="number" className={fieldCls} value={detailForm.totalUnits} min={1} onChange={(e) => setDetailForm((f) => f ? { ...f, totalUnits: parseInt(e.target.value) || 1 } : f)} />
                  </div>
                  <div>
                    <label className="text-[11.5px] text-[#6b7280] block mb-1">현재 권</label>
                    <input type="number" className={fieldCls} value={detailForm.currentUnit} min={1} onChange={(e) => setDetailForm((f) => f ? { ...f, currentUnit: parseInt(e.target.value) || 1 } : f)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11.5px] text-[#6b7280] block mb-1">ISBN</label>
                    <input className={fieldCls} value={detailForm.isbn} onChange={(e) => setDetailForm((f) => f ? { ...f, isbn: e.target.value } : f)} />
                  </div>
                  <div>
                    <label className="text-[11.5px] text-[#6b7280] block mb-1">구입일</label>
                    <input type="date" className={fieldCls} value={detailForm.purchaseDate} onChange={(e) => setDetailForm((f) => f ? { ...f, purchaseDate: e.target.value } : f)} />
                  </div>
                </div>
                <div>
                  <label className="text-[11.5px] text-[#6b7280] block mb-1">메모</label>
                  <textarea className={fieldCls + ' resize-none'} rows={2} value={detailForm.memo} onChange={(e) => setDetailForm((f) => f ? { ...f, memo: e.target.value } : f)} />
                </div>
              </>
            ) : (
              /* 읽기 전용 상세 */
              <>
                <div className="flex items-center gap-3 pb-3 border-b border-[#f1f5f9]">
                  <div className="w-11 h-11 rounded-[10px] bg-[#E1F5EE] flex items-center justify-center shrink-0">
                    <BookOpen size={20} className="text-[#4fc3a1]" />
                  </div>
                  <div>
                    <div className="text-[14px] font-bold text-[#111827]">{detailBook.name}</div>
                    <div className="text-[12px] text-[#6b7280]">{detailBook.publisher}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12.5px]">
                  <div>
                    <div className="text-[11px] text-[#9ca3af] mb-0.5">가격</div>
                    <div className="font-medium text-[#111827]">{detailBook.price.toLocaleString()}원/{detailBook.unit}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#9ca3af] mb-0.5">구성</div>
                    <div className="font-medium text-[#111827]">전 {detailBook.totalUnits}{detailBook.unit}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#9ca3af] mb-0.5">현재 진행</div>
                    <div className="font-semibold text-[#4fc3a1]">{detailBook.currentUnit}{detailBook.unit} 진행 중</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#9ca3af] mb-0.5">구입일</div>
                    <div className="font-medium text-[#111827]">{detailBook.purchaseDate || '—'}</div>
                  </div>
                  {detailBook.isbn && (
                    <div className="col-span-2">
                      <div className="text-[11px] text-[#9ca3af] mb-0.5">ISBN</div>
                      <div className="font-medium text-[#111827] font-mono text-[11.5px]">{detailBook.isbn}</div>
                    </div>
                  )}
                  {detailBook.memo && (
                    <div className="col-span-2">
                      <div className="text-[11px] text-[#9ca3af] mb-0.5">메모</div>
                      <div className="text-[#374151] bg-[#f4f6f8] rounded-[8px] px-3 py-2">{detailBook.memo}</div>
                    </div>
                  )}
                </div>
                {/* 진행 진도바 */}
                {detailBook.totalUnits > 1 && (
                  <div className="pt-2">
                    <div className="flex justify-between text-[11px] text-[#6b7280] mb-1">
                      <span>진행 현황</span>
                      <span>{detailBook.currentUnit}/{detailBook.totalUnits}{detailBook.unit}</span>
                    </div>
                    <div className="h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#4fc3a1] rounded-full"
                        style={{ width: `${Math.round((detailBook.currentUnit / detailBook.totalUnits) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
