'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import BottomTabBar from '@/components/mobile/BottomTabBar';

type PageStatus = 'scanning' | 'loading' | 'success' | 'already' | 'error';
type Result = { studentName: string; className: string; checkInTime: string; status: string };

const STATUS_LABEL: Record<string, string> = { PRESENT: '출석', LATE: '지각' };

export default function AttendanceCheckPage() {
  const [pageStatus, setPageStatus] = useState<PageStatus>('scanning');
  const [result, setResult] = useState<Result | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);
  const stoppedRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    const startScanner = async () => {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          async (decodedText: string) => {
            if (stoppedRef.current) return;
            stoppedRef.current = true;
            await scanner.stop().catch(() => {});
            setPageStatus('loading');

            try {
              const res = await fetch('/api/kiosk/check-in', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: decodedText }),
              });
              const data = await res.json();

              if (res.ok && data.success) {
                setResult(data);
                setPageStatus(data.alreadyChecked ? 'already' : 'success');
              } else {
                setErrorMsg(data.error ?? '출석 체크에 실패했습니다.');
                setPageStatus('error');
              }
            } catch {
              setErrorMsg('네트워크 오류가 발생했습니다.');
              setPageStatus('error');
            }
          },
          () => {} // 프레임 디코드 에러는 무시
        );
      } catch {
        setErrorMsg('카메라 접근 권한이 필요합니다.\n브라우저 설정에서 카메라를 허용해주세요.');
        setPageStatus('error');
      }
    };

    startScanner();

    return () => {
      stoppedRef.current = true;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const retry = () => {
    stoppedRef.current = false;
    router.refresh();
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f8f9fa] pb-[calc(5rem+env(safe-area-inset-bottom))]">
      {/* 헤더 */}
      <div className="bg-[#1a2535] px-4 pt-12 pb-5">
        <div className="flex items-center gap-3">
          <Link href="/mobile"><ChevronLeft size={20} className="text-white" /></Link>
          <span className="text-[17px] font-bold text-white">출석 체크</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        {/* 스캐너 */}
        {pageStatus === 'scanning' && (
          <div className="w-full flex flex-col items-center">
            <p className="text-[15px] font-semibold text-[#111827] mb-1 text-center">
              학원 입구의 QR 코드를 스캔하세요
            </p>
            <p className="text-[12.5px] text-[#6b7280] mb-5 text-center">
              카메라가 QR을 자동으로 인식합니다
            </p>
            <div className="rounded-[16px] overflow-hidden w-full max-w-[320px] shadow-md">
              <div id="qr-reader" className="w-full" />
            </div>
          </div>
        )}

        {/* 처리 중 */}
        {pageStatus === 'loading' && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={52} className="text-[#4fc3a1] animate-spin" />
            <p className="text-[15px] text-[#374151]">출석 처리 중...</p>
          </div>
        )}

        {/* 성공 / 이미 출석 */}
        {(pageStatus === 'success' || pageStatus === 'already') && result && (
          <div className="flex flex-col items-center gap-4 w-full max-w-[320px]">
            <CheckCircle size={72} className="text-[#4fc3a1]" />
            <p className="text-[22px] font-bold text-[#111827]">
              {pageStatus === 'already' ? '이미 출석 완료' : '출석 완료!'}
            </p>
            <div className="bg-white rounded-[16px] border border-[#e2e8f0] p-5 w-full text-center">
              <p className="text-[18px] font-bold text-[#111827] mb-1">{result.studentName}</p>
              <p className="text-[13px] text-[#6b7280] mb-3">{result.className}</p>
              <div className="flex items-center justify-center gap-2">
                <span
                  className="px-3 py-1 rounded-full text-[12px] font-semibold"
                  style={{
                    backgroundColor: result.status === 'LATE' ? '#FEF3C7' : '#D1FAE5',
                    color: result.status === 'LATE' ? '#92400E' : '#065f46',
                  }}
                >
                  {STATUS_LABEL[result.status] ?? result.status}
                </span>
                <span className="text-[13px] text-[#6b7280]">{result.checkInTime} 체크인</span>
              </div>
            </div>
            <Link
              href="/mobile"
              className="w-full py-3 bg-[#4fc3a1] text-white rounded-[12px] text-[15px] font-semibold text-center block"
            >
              홈으로
            </Link>
          </div>
        )}

        {/* 오류 */}
        {pageStatus === 'error' && (
          <div className="flex flex-col items-center gap-4 w-full max-w-[320px]">
            <XCircle size={72} className="text-[#ef4444]" />
            <p className="text-[18px] font-bold text-[#111827] text-center">출석 체크 실패</p>
            <p className="text-[13px] text-[#6b7280] text-center whitespace-pre-line">{errorMsg}</p>
            <button
              onClick={retry}
              className="w-full py-3 bg-[#4fc3a1] text-white rounded-[12px] text-[15px] font-semibold cursor-pointer"
            >
              다시 시도
            </button>
            <Link
              href="/mobile"
              className="w-full py-3 bg-white border border-[#e2e8f0] text-[#374151] rounded-[12px] text-[15px] font-semibold text-center block"
            >
              홈으로
            </Link>
          </div>
        )}
      </div>

      <BottomTabBar />
    </div>
  );
}
