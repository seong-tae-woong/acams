'use client';
import { useState } from 'react';
import { mockStudents } from '@/lib/mock/students';
import { useClassStore } from '@/lib/stores/classStore';
import { DAY_NAMES } from '@/lib/types/class';
import { ScanLine, Hash, CheckCircle, XCircle } from 'lucide-react';
import clsx from 'clsx';

type Step = 'idle' | 'qr' | 'number' | 'success' | 'notfound';

const TODAY = '2026-04-18';
const TODAY_DOW = new Date(TODAY).getDay() || 7; // 6(토)

export default function KioskPage() {
  const { classes } = useClassStore();
  const [step, setStep] = useState<Step>('idle');
  const [inputNum, setInputNum] = useState('');
  const [checkedStudent, setCheckedStudent] = useState<typeof mockStudents[0] | null>(null);

  const todayClasses = classes.filter((c) => c.schedule.some((s) => s.dayOfWeek === TODAY_DOW));

  const handleNumberCheck = () => {
    const student = mockStudents.find((s) => s.attendanceNumber === inputNum);
    if (student) {
      setCheckedStudent(student);
      setStep('success');
    } else {
      setStep('notfound');
    }
  };

  const handleQRSimulate = () => {
    // 시뮬레이션: QR 스캔 → 첫 번째 학생으로 체크인
    setCheckedStudent(mockStudents[0]);
    setStep('success');
  };

  const reset = () => {
    setStep('idle');
    setInputNum('');
    setCheckedStudent(null);
  };

  // 숫자 패드
  const numPad = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  const pressKey = (key: string) => {
    if (key === '⌫') setInputNum((p) => p.slice(0, -1));
    else if (inputNum.length < 4) setInputNum((p) => p + key);
  };

  return (
    <div className="min-h-screen bg-[#0f1a2b] flex flex-col items-center justify-between p-8">
      {/* 상단: 학원명 + 날짜 */}
      <div className="w-full text-center pt-4">
        <div className="text-[#4fc3a1] text-[18px] font-semibold mb-1">세계로학원</div>
        <div className="text-white/40 text-[14px]">
          {TODAY} ({DAY_NAMES[TODAY_DOW]}요일) · 출결 체크 키오스크
        </div>
        {todayClasses.length > 0 && (
          <div className="mt-2 flex justify-center gap-2 flex-wrap">
            {todayClasses.map((c) => (
              <span key={c.id} className="px-2.5 py-1 rounded-full text-[12px] font-medium text-white" style={{ backgroundColor: c.color + '80' }}>
                {c.name} · {c.schedule.find((s) => s.dayOfWeek === TODAY_DOW)?.startTime}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 가운데: 메인 콘텐츠 */}
      <div className="flex-1 flex items-center justify-center w-full">
        {step === 'idle' && (
          <div className="text-center">
            <div className="text-white text-[36px] font-bold mb-2">출결 체크</div>
            <div className="text-white/50 text-[16px] mb-10">QR 스캔 또는 출석번호를 입력하세요</div>
            <div className="flex gap-6 justify-center">
              <button
                onClick={() => setStep('qr')}
                className="flex flex-col items-center gap-3 bg-white/10 hover:bg-white/20 rounded-[20px] p-8 w-52 transition-colors cursor-pointer"
              >
                <ScanLine size={56} className="text-[#4fc3a1]" />
                <span className="text-white text-[18px] font-semibold">QR 스캔</span>
              </button>
              <button
                onClick={() => setStep('number')}
                className="flex flex-col items-center gap-3 bg-white/10 hover:bg-white/20 rounded-[20px] p-8 w-52 transition-colors cursor-pointer"
              >
                <Hash size={56} className="text-[#4fc3a1]" />
                <span className="text-white text-[18px] font-semibold">출석번호 입력</span>
              </button>
            </div>
          </div>
        )}

        {step === 'qr' && (
          <div className="text-center">
            <div className="text-white text-[28px] font-bold mb-4">QR 코드를 스캔하세요</div>
            <div className="w-64 h-64 border-4 border-[#4fc3a1] rounded-[20px] flex items-center justify-center mx-auto mb-8 relative">
              <ScanLine size={80} className="text-[#4fc3a1] opacity-50" />
              {/* 스캔 애니메이션 시뮬레이션 */}
              <div className="absolute top-0 left-0 w-full h-1 bg-[#4fc3a1] animate-bounce" />
            </div>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleQRSimulate}
                className="px-8 py-3 bg-[#4fc3a1] text-white rounded-[12px] text-[16px] font-semibold cursor-pointer"
              >
                스캔 시뮬레이션
              </button>
              <button
                onClick={reset}
                className="px-8 py-3 bg-white/10 text-white rounded-[12px] text-[16px] cursor-pointer"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {step === 'number' && (
          <div className="text-center">
            <div className="text-white text-[28px] font-bold mb-2">출석번호 입력</div>
            <div className="text-white/40 text-[14px] mb-6">4자리 출석번호를 입력하세요</div>

            {/* 입력 디스플레이 */}
            <div className="bg-white/10 rounded-[16px] px-8 py-4 mb-6 w-64 mx-auto">
              <div className="text-[42px] font-bold text-white text-center tracking-[12px] min-h-[60px]">
                {inputNum || <span className="text-white/20">____</span>}
              </div>
            </div>

            {/* 숫자 패드 */}
            <div className="grid grid-cols-3 gap-3 w-64 mx-auto mb-6">
              {numPad.map((key, i) => (
                <button
                  key={i}
                  onClick={() => key && pressKey(key)}
                  disabled={!key}
                  className={clsx(
                    'h-16 rounded-[12px] text-[22px] font-semibold transition-colors',
                    key
                      ? 'bg-white/10 text-white hover:bg-white/20 cursor-pointer'
                      : 'opacity-0 pointer-events-none',
                  )}
                >
                  {key}
                </button>
              ))}
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={handleNumberCheck}
                disabled={inputNum.length < 4}
                className="px-8 py-3 bg-[#4fc3a1] disabled:opacity-40 text-white rounded-[12px] text-[16px] font-semibold cursor-pointer"
              >
                확인
              </button>
              <button onClick={reset} className="px-8 py-3 bg-white/10 text-white rounded-[12px] text-[16px] cursor-pointer">
                취소
              </button>
            </div>
          </div>
        )}

        {step === 'success' && checkedStudent && (
          <div className="text-center">
            <CheckCircle size={80} className="text-[#4fc3a1] mx-auto mb-4" />
            <div className="text-[#4fc3a1] text-[32px] font-bold mb-2">출석 완료!</div>
            <div className="text-white text-[24px] font-semibold mb-1">{checkedStudent.name}</div>
            <div className="text-white/60 text-[16px] mb-2">{checkedStudent.school} {checkedStudent.grade}학년</div>
            <div className="text-white/40 text-[14px] mb-10">
              {TODAY} {new Date().getHours()}:{String(new Date().getMinutes()).padStart(2, '0')} 체크인
            </div>
            <button
              onClick={reset}
              className="px-10 py-3 bg-white/10 text-white rounded-[12px] text-[16px] cursor-pointer"
            >
              닫기
            </button>
          </div>
        )}

        {step === 'notfound' && (
          <div className="text-center">
            <XCircle size={80} className="text-[#ef4444] mx-auto mb-4" />
            <div className="text-[#ef4444] text-[28px] font-bold mb-2">학생을 찾을 수 없습니다</div>
            <div className="text-white/60 text-[16px] mb-10">출석번호 '{inputNum}'을 다시 확인해주세요</div>
            <div className="flex gap-4 justify-center">
              <button onClick={() => { setInputNum(''); setStep('number'); }} className="px-8 py-3 bg-[#4fc3a1] text-white rounded-[12px] text-[16px] font-semibold cursor-pointer">
                다시 입력
              </button>
              <button onClick={reset} className="px-8 py-3 bg-white/10 text-white rounded-[12px] text-[16px] cursor-pointer">
                처음으로
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 하단 */}
      <div className="text-white/20 text-[12px] pb-4">
        세계로학원 출결 키오스크 v1.0 · 문의: 02-1234-5678
      </div>
    </div>
  );
}
