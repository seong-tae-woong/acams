'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/stores/toastStore';

type State = 'unsupported' | 'denied' | 'off' | 'on' | 'loading';

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return buf;
}

export default function PushNotificationToggle() {
  const [state, setState] = useState<State>('loading');
  // iOS는 PWA(홈 화면 추가) 모드에서만 푸시 가능, 그 외 플랫폼은 일반 브라우저에서도 가능
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as unknown as { MSStream?: unknown }).MSStream;
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator && (window.navigator as Navigator & { standalone?: boolean }).standalone === true);
    setIosNeedsInstall(isIOS && !standalone);

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') { setState('denied'); return; }

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? 'on' : 'off'))
      .catch(() => setState('off'));
  }, []);

  const enable = async () => {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      toast('서버에 푸시 키가 설정되지 않았습니다.', 'error');
      return;
    }
    setState('loading');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setState(perm === 'denied' ? 'denied' : 'off');
        if (perm === 'denied') toast('알림 권한이 차단되었습니다. 브라우저/시스템 설정에서 허용해 주세요.', 'error');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(publicKey),
      });
      const json = sub.toJSON();
      const res = await fetch('/api/mobile/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent,
        }),
      });
      if (!res.ok) {
        await sub.unsubscribe().catch(() => {});
        throw new Error('서버 등록에 실패했습니다.');
      }
      setState('on');
      toast('휴대폰 알림이 켜졌습니다.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알림 설정 중 오류가 발생했습니다.';
      toast(msg, 'error');
      setState('off');
    }
  };

  const disable = async () => {
    setState('loading');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(`/api/mobile/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`, {
          method: 'DELETE',
        }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      setState('off');
    } catch {
      setState('on');
    }
  };

  const isOn = state === 'on';
  const disabled = state === 'loading' || state === 'unsupported' || state === 'denied' || iosNeedsInstall;

  let hint = '';
  if (iosNeedsInstall) hint = 'iOS에서는 "홈 화면에 추가" 후 사용 가능합니다.';
  else if (state === 'unsupported') hint = '이 브라우저에서는 지원되지 않습니다.';
  else if (state === 'denied') hint = '브라우저 설정에서 알림 권한을 허용해 주세요.';
  else hint = '신규 알림·숙제·시험 등록 시 휴대폰에 알림';

  return (
    <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
      <div className="text-[13px] font-semibold text-[#111827] mb-3">알림 설정</div>
      <div className="flex items-center justify-between py-2.5">
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-medium text-[#111827]">휴대폰 알림 받기</div>
          <div className="text-[11px] text-[#9ca3af]">{hint}</div>
        </div>
        <button
          onClick={() => (isOn ? disable() : enable())}
          disabled={disabled}
          aria-pressed={isOn}
          aria-label={isOn ? '휴대폰 알림 끄기' : '휴대폰 알림 켜기'}
          className={`relative w-9 h-5 rounded-full transition-colors ${
            isOn ? 'bg-[#4fc3a1]' : 'bg-[#cbd5e1]'
          } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div
            className={`absolute w-3.5 h-3.5 bg-white rounded-full top-[3px] transition-all ${
              isOn ? 'left-[19px]' : 'left-[3px]'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
