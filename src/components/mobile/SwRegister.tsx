'use client';
import { useEffect } from 'react';

export default function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // 서비스 워커 등록 실패는 무시 (오프라인 기능만 영향)
      });
    }
  }, []);
  return null;
}
