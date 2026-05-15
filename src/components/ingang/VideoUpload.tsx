'use client';
import { useState, useRef, useCallback } from 'react';

// ─── 동영상 업로드 컴포넌트 (Cloudflare Stream 직접 업로드) ────
type UploadState = 'idle' | 'uploading' | 'done' | 'error';

export function VideoUpload({ onComplete }: {
  onComplete: (uid: string, filename: string) => void;
}) {
  const [state,    setState]    = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [filename, setFilename] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const startUpload = useCallback(async (file: File) => {
    const allowed = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/avi'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(mp4|mov|avi)$/i)) {
      setErrorMsg('MP4, MOV, AVI 파일만 업로드할 수 있습니다.');
      setState('error');
      return;
    }

    setFilename(file.name);
    setState('uploading');
    setProgress(0);
    setErrorMsg('');

    try {
      // 1. 서버에서 Cloudflare 업로드 URL 발급
      const res = await fetch('/api/lectures/upload-url', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? '업로드 URL 발급 실패');
      }
      const { uploadURL, uid } = await res.json();

      // 2. tus-js-client로 Cloudflare에 직접 업로드
      const { Upload } = await import('tus-js-client');

      await new Promise<void>((resolve, reject) => {
        const upload = new Upload(file, {
          uploadUrl: uploadURL,
          chunkSize: 50 * 1024 * 1024, // 50MB 청크
          retryDelays: [0, 3000, 5000, 10000, 20000],
          metadata: { name: file.name, type: file.type },
          onProgress: (sent, total) => {
            setProgress(Math.round((sent / total) * 100));
          },
          onSuccess: () => {
            onComplete(uid, file.name);
            setState('done');
            resolve();
          },
          onError: (err) => {
            reject(err);
          },
        });

        abortRef.current = () => upload.abort();
        upload.start();
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '업로드에 실패했습니다.';
      setErrorMsg(msg);
      setState('error');
    }
  }, [onComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) startUpload(file);
  }, [startUpload]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) startUpload(file);
  }, [startUpload]);

  const reset = () => {
    abortRef.current?.();
    setState('idle');
    setProgress(0);
    setFilename('');
    setErrorMsg('');
    if (inputRef.current) inputRef.current.value = '';
  };

  // ── idle: 드롭존 ───────────────────────────────────────
  if (state === 'idle') {
    return (
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-[#e2e8f0] rounded-[10px] p-7 text-center cursor-pointer hover:border-[#a78bfa] hover:bg-[#EEEDFE]/30 transition-all"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".mp4,.mov,.avi,video/mp4,video/quicktime,video/x-msvideo"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="w-11 h-11 rounded-xl mx-auto mb-2.5 flex items-center justify-center text-lg" style={{ background: '#EEEDFE' }}>▶</div>
        <p className="text-[13px] font-semibold text-[#1a2535] mb-1">영상 파일을 드래그하거나 클릭하여 업로드</p>
        <p className="text-[11.5px] text-[#9ca3af]">MP4, MOV, AVI 지원 · 최대 2GB</p>
      </div>
    );
  }

  // ── uploading: 진행바 ──────────────────────────────────
  if (state === 'uploading') {
    return (
      <div className="border border-[#e2e8f0] rounded-[10px] px-4 py-3.5">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[12.5px] font-semibold text-[#1a2535] truncate max-w-[70%]">{filename}</span>
          <span className="text-[12.5px] font-semibold" style={{ color: '#a78bfa' }}>{progress}%</span>
        </div>
        <div className="h-1.5 bg-[#e2e8f0] rounded-full overflow-hidden mb-2">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, background: '#a78bfa' }}
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-[#9ca3af]">업로드 중 · Cloudflare Stream으로 전송</span>
          <button onClick={reset} className="text-[11px] text-[#9ca3af] hover:text-[#ef4444]">취소</button>
        </div>
      </div>
    );
  }

  // ── done: 완료 ─────────────────────────────────────────
  if (state === 'done') {
    return (
      <div className="border border-[#e2e8f0] rounded-[10px] px-4 py-3.5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0" style={{ background: '#1e1b2e' }}>
          <span style={{ borderTop: '7px solid transparent', borderBottom: '7px solid transparent', borderLeft: '11px solid #a78bfa', marginLeft: 1, display: 'inline-block' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-semibold text-[#111827] truncate">{filename}</p>
          <p className="text-[11px] text-[#9ca3af]">Cloudflare Stream 업로드 완료 · 인코딩 중 (수 분 소요)</p>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0" style={{ background: '#D1FAE5', color: '#065f46' }}>완료</span>
        <button onClick={reset} className="text-[11px] text-[#9ca3af] hover:text-[#374151] shrink-0">교체</button>
      </div>
    );
  }

  // ── error ──────────────────────────────────────────────
  return (
    <div className="border border-[#FEE2E2] rounded-[10px] px-4 py-3.5">
      <p className="text-[12.5px] font-semibold text-[#991b1b] mb-1">업로드 실패</p>
      <p className="text-[11.5px] text-[#9ca3af] mb-2.5">{errorMsg}</p>
      <button
        onClick={reset}
        className="px-3 py-1.5 rounded-[8px] text-[12px] font-medium border border-[#e2e8f0] bg-white text-[#374151] hover:bg-gray-50"
      >
        다시 시도
      </button>
    </div>
  );
}
