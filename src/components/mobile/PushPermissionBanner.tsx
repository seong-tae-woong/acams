'use client';
import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';
import { enablePushSubscription, silentlyResubscribeIfPossible } from '@/lib/push/clientSubscribe';

const DISMISS_KEY = 'acams_push_prompt_dismissed';

// 홈 상단에 노출되는 "휴대폰 알림 켜기" 안내 배너.
// 다음 모든 조건이 참일 때만 노출:
// - SW/PushManager 지원
// - iOS면 PWA standalone 모드
// - Notification.permission === 'default' (한 번도 응답 안 함)
// - 사용자가 X로 닫지 않음 (localStorage 플래그)
// 권한이 이미 'granted'인데 구독이 사라진 경우(기기 변경 등)에는 조용히 자동 재구독.
export default function PushPermissionBanner() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as unknown as { MSStream?: unknown }).MSStream;
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator && (window.navigator as Navigator & { standalone?: boolean }).standalone === true);
    if (isIOS && !standalone) return; // iOS는 PWA 진입 시에만

    if (Notification.permission === 'granted') {
      // 권한은 있는데 구독이 사라졌으면 자동 복구
      void silentlyResubscribeIfPossible();
      return;
    }
    if (Notification.permission === 'denied') return;

    // permission === 'default' — 사용자에게 한 번 물어볼 차례
    if (localStorage.getItem(DISMISS_KEY) === '1') return;
    setShow(true);
  }, []);

  const onEnable = async () => {
    setBusy(true);
    const result = await enablePushSubscription();
    setBusy(false);
    if (result.ok) {
      toast('휴대폰 알림이 켜졌습니다.', 'success');
      setShow(false);
      return;
    }
    if (result.reason === 'denied') {
      toast('알림 권한이 차단되었습니다. 시스템 설정에서 허용 후 다시 시도해 주세요.', 'error');
      setShow(false);
    } else if (result.reason === 'no-key') {
      toast('서버에 푸시 키가 설정되지 않았습니다.', 'error');
    } else {
      toast('알림 설정 중 오류가 발생했습니다.', 'error');
    }
  };

  const onDismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="bg-[#EEF7F4] border border-[#4fc3a1]/40 rounded-[12px] p-3.5 flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-[#4fc3a1] flex items-center justify-center shrink-0">
        <Bell size={16} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-semibold text-[#111827]">휴대폰 알림 받기</div>
        <div className="text-[11.5px] text-[#6b7280]">새 공지·숙제·시험 등록 시 즉시 알림</div>
      </div>
      <button
        onClick={onEnable}
        disabled={busy}
        className="px-3 py-1.5 rounded-[8px] bg-[#4fc3a1] text-white text-[12px] font-semibold disabled:opacity-60 cursor-pointer active:opacity-80 shrink-0"
      >
        {busy ? '설정 중...' : '켜기'}
      </button>
      <button
        onClick={onDismiss}
        aria-label="배너 닫기"
        className="p-1 text-[#9ca3af] cursor-pointer shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  );
}
