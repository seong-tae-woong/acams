'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { XCircle } from 'lucide-react';

function FailContent() {
  const searchParams = useSearchParams();
  const message = searchParams.get('message') ?? '결제가 취소되었거나 오류가 발생했습니다.';
  const code    = searchParams.get('code') ?? '';

  return (
    <div className="flex flex-col items-center justify-center gap-5 py-20 px-6">
      <XCircle size={64} className="text-red-400" />
      <div className="text-center">
        <p className="text-[18px] font-bold text-[#111827] mb-2">결제에 실패했습니다</p>
        <p className="text-[13px] text-[#6b7280] leading-relaxed">{message}</p>
        {code && (
          <p className="text-[11.5px] text-[#9ca3af] mt-1">오류 코드: {code}</p>
        )}
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <Link href="/mobile/payments">
          <button
            className="w-full py-3 rounded-[10px] text-[14px] font-semibold text-white cursor-pointer"
            style={{ backgroundColor: '#4fc3a1' }}
          >
            다시 시도하기
          </button>
        </Link>
        <Link href="/mobile/payments">
          <button
            className="w-full py-3 rounded-[10px] text-[14px] font-semibold text-[#6b7280] bg-[#f1f5f9] cursor-pointer"
          >
            수납 내역으로 돌아가기
          </button>
        </Link>
      </div>
    </div>
  );
}

export default function PaymentFailPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="bg-[#1a2535] px-4 pt-12 pb-5">
        <span className="text-[17px] font-bold text-white">결제 결과</span>
      </div>
      <Suspense fallback={<div className="py-20 text-center text-[#9ca3af]">불러오는 중...</div>}>
        <FailContent />
      </Suspense>
    </div>
  );
}
