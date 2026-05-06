'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const paymentKey = searchParams.get('paymentKey') ?? '';
  const orderId    = searchParams.get('orderId') ?? '';
  const amount     = Number(searchParams.get('amount') ?? '0');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [method, setMethod] = useState('');

  useEffect(() => {
    if (!paymentKey || !orderId || !amount) {
      setErrorMsg('결제 정보가 올바르지 않습니다.');
      setStatus('error');
      return;
    }

    // 토스 결제 승인 요청
    fetch('/api/mobile/payments/toss/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (data.success) {
          setMethod(data.method ?? '');
          setStatus('success');
        } else if (r.status === 409) {
          // 웹훅이 먼저 처리했거나 이미 완료된 결제 — 성공으로 처리
          setStatus('success');
        } else {
          setErrorMsg(data.error ?? '결제 승인에 실패했습니다.');
          setStatus('error');
        }
      })
      .catch(() => {
        setErrorMsg('서버 연결에 실패했습니다.');
        setStatus('error');
      });
  }, [paymentKey, orderId, amount]);

  // 3초 후 수납 내역 페이지로 이동
  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => router.replace('/mobile/payments'), 3000);
      return () => clearTimeout(timer);
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <Loader2 size={48} className="animate-spin text-[#4fc3a1]" />
        <p className="text-[15px] font-medium text-[#374151]">결제를 처리하고 있습니다...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-20 px-6">
        <XCircle size={56} className="text-red-400" />
        <div className="text-center">
          <p className="text-[16px] font-bold text-[#111827] mb-1">결제에 실패했습니다</p>
          <p className="text-[13px] text-[#6b7280]">{errorMsg}</p>
        </div>
        <Link href="/mobile/payments">
          <button className="px-6 py-3 rounded-[10px] text-[14px] font-semibold text-white cursor-pointer" style={{ backgroundColor: '#4fc3a1' }}>
            수납 내역으로 돌아가기
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-5 py-20 px-6">
      <CheckCircle size={64} className="text-[#4fc3a1]" />
      <div className="text-center">
        <p className="text-[20px] font-bold text-[#111827] mb-1">결제 완료!</p>
        <p className="text-[15px] font-semibold text-[#0D9E7A] mb-1">
          {amount.toLocaleString()}원
        </p>
        {method && (
          <p className="text-[13px] text-[#6b7280]">{method}으로 결제되었습니다.</p>
        )}
      </div>
      <div className="bg-[#f1f5f9] rounded-[12px] p-4 w-full max-w-xs text-center">
        <p className="text-[12.5px] text-[#6b7280]">영수증이 자동 발행되었습니다.</p>
        <p className="text-[11.5px] text-[#9ca3af] mt-1">잠시 후 수납 내역으로 이동합니다.</p>
      </div>
      <Link href="/mobile/payments">
        <button className="px-6 py-3 rounded-[10px] text-[14px] font-semibold text-white cursor-pointer" style={{ backgroundColor: '#4fc3a1' }}>
          수납 내역 확인하기
        </button>
      </Link>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="bg-[#1a2535] px-4 pt-12 pb-5">
        <span className="text-[17px] font-bold text-white">결제 결과</span>
      </div>
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <Loader2 size={48} className="animate-spin text-[#4fc3a1]" />
          <p className="text-[15px] text-[#374151]">불러오는 중...</p>
        </div>
      }>
        <SuccessContent />
      </Suspense>
    </div>
  );
}
