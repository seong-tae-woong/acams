'use client';
import { useState, useEffect } from 'react';
import Button from '@/components/shared/Button';
import { Globe, Copy, ExternalLink, X, Plus } from 'lucide-react';
import { toast } from '@/lib/stores/toastStore';
import clsx from 'clsx';
import { fieldCls } from '../_shared';

export default function ProfileTab() {
  // 공개 프로필 상태
  const [profileForm, setProfileForm] = useState({
    slug: '',
    intro: '',
    directorName: '',
    businessNumber: '',
    phone: '',
    address: '',
    operatingHours: '',
    refundPolicy: '',
    showFees: true,
    profileEnabled: false,
    kakaoMapUrl: '',
    galleryImages: Array(6).fill('') as string[],
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  useEffect(() => {
    setProfileLoading(true);
    fetch('/api/settings/academy')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const imgs = [...(data.galleryImages ?? []), '', '', '', '', '', ''].slice(0, 6);
        setProfileForm({
          slug: data.slug ?? '',
          intro: data.intro ?? '',
          directorName: data.directorName ?? '',
          businessNumber: data.businessNumber ?? '',
          phone: data.phone ?? '',
          address: data.address ?? '',
          operatingHours: data.operatingHours ?? '',
          refundPolicy: data.refundPolicy ?? '',
          showFees: data.showFees ?? true,
          profileEnabled: data.profileEnabled ?? false,
          kakaoMapUrl: data.kakaoMapUrl ?? '',
          galleryImages: imgs,
        });
      })
      .finally(() => setProfileLoading(false));
  }, []); // eslint-disable-line

  const saveProfile = async () => {
    setProfileSaving(true);
    try {
      // galleryImages는 갤러리 API로 별도 관리, slug는 읽기 전용
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { galleryImages, slug, ...fields } = profileForm;
      const res = await fetch('/api/settings/academy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        toast('공개 프로필이 저장되었습니다.', 'success');
      } else {
        toast('저장에 실패했습니다.', 'error');
      }
    } finally {
      setProfileSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIndex(index);
    try {
      const imageCompression = (await import('browser-image-compression')).default;
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 800,
        useWebWorker: true,
      });
      const formData = new FormData();
      formData.append('file', compressed, 'image.jpg');
      formData.append('index', String(index));
      const res = await fetch('/api/settings/gallery', { method: 'POST', body: formData });
      if (!res.ok) {
        toast('업로드에 실패했습니다.', 'error');
        return;
      }
      const { url } = await res.json();
      setProfileForm((f) => {
        const imgs = [...f.galleryImages];
        imgs[index] = url;
        return { ...f, galleryImages: imgs };
      });
      toast('사진이 업로드되었습니다.', 'success');
    } catch {
      toast('업로드에 실패했습니다.', 'error');
    } finally {
      setUploadingIndex(null);
      e.target.value = '';
    }
  };

  const deleteImage = async (index: number) => {
    const res = await fetch(`/api/settings/gallery?index=${index}`, { method: 'DELETE' });
    if (!res.ok) { toast('삭제에 실패했습니다.', 'error'); return; }
    setProfileForm((f) => {
      const imgs = [...f.galleryImages];
      imgs[index] = '';
      return { ...f, galleryImages: imgs };
    });
    toast('사진이 삭제되었습니다.', 'success');
  };

  return (
    <div className="space-y-4 max-w-xl">
      {profileLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-[#4fc3a1] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* 공개 페이지 URL */}
          <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Globe size={14} className="text-[#4fc3a1]" />
              <span className="text-[13px] font-semibold text-[#111827]">공개 페이지 URL</span>
            </div>
            {profileForm.slug ? (
              <div className="flex items-center gap-2 bg-[#f4f6f8] rounded-[8px] px-3 py-2 mb-3">
                <span className="text-[12px] text-[#374151] flex-1 font-mono truncate">
                  /academy/{profileForm.slug}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/academy/${profileForm.slug}`);
                    toast('URL이 복사되었습니다.', 'success');
                  }}
                  className="text-[#9ca3af] hover:text-[#4fc3a1] transition-colors cursor-pointer shrink-0"
                  title="URL 복사"
                >
                  <Copy size={13} />
                </button>
                <a
                  href={`/academy/${profileForm.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#9ca3af] hover:text-[#4fc3a1] transition-colors shrink-0"
                  title="페이지 미리보기"
                >
                  <ExternalLink size={13} />
                </a>
              </div>
            ) : (
              <p className="text-[12px] text-[#9ca3af] mb-3">슬러그가 설정되지 않았습니다.</p>
            )}
            <div className="flex items-center justify-between py-2 border-t border-[#f1f5f9]">
              <div>
                <div className="text-[12.5px] font-medium text-[#111827]">페이지 공개</div>
                <div className="text-[11px] text-[#9ca3af]">비활성 시 학원 소개 페이지 접근 불가</div>
              </div>
              <div
                className={clsx('w-9 h-5 rounded-full relative cursor-pointer transition-colors', profileForm.profileEnabled ? 'bg-[#4fc3a1]' : 'bg-[#e2e8f0]')}
                onClick={() => setProfileForm((f) => ({ ...f, profileEnabled: !f.profileEnabled }))}
              >
                <div className={clsx('absolute w-3.5 h-3.5 bg-white rounded-full top-[3px] transition-all', profileForm.profileEnabled ? 'left-[19px]' : 'left-[3px]')} />
              </div>
            </div>
          </div>

          {/* 학원 소개 */}
          <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4 space-y-3">
            <div className="text-[13px] font-semibold text-[#111827] mb-1">학원 소개</div>
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">소개글</label>
              <textarea
                rows={3}
                value={profileForm.intro}
                onChange={(e) => setProfileForm((f) => ({ ...f, intro: e.target.value }))}
                placeholder="학원 소개글을 입력하세요"
                className={clsx(fieldCls, 'resize-none')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11.5px] text-[#6b7280] block mb-1">대표자명</label>
                <input type="text" value={profileForm.directorName} onChange={(e) => setProfileForm((f) => ({ ...f, directorName: e.target.value }))} className={fieldCls} placeholder="홍길동" />
              </div>
              <div>
                <label className="text-[11.5px] text-[#6b7280] block mb-1">사업자등록번호</label>
                <input type="text" value={profileForm.businessNumber} onChange={(e) => setProfileForm((f) => ({ ...f, businessNumber: e.target.value }))} className={fieldCls} placeholder="000-00-00000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11.5px] text-[#6b7280] block mb-1">대표 전화</label>
                <input type="text" value={profileForm.phone} onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))} className={fieldCls} placeholder="02-0000-0000" />
              </div>
              <div>
                <label className="text-[11.5px] text-[#6b7280] block mb-1">주소</label>
                <input type="text" value={profileForm.address} onChange={(e) => setProfileForm((f) => ({ ...f, address: e.target.value }))} className={fieldCls} placeholder="서울시 강남구..." />
              </div>
            </div>
          </div>

          {/* 운영 정보 */}
          <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4 space-y-3">
            <div className="text-[13px] font-semibold text-[#111827] mb-1">운영 정보</div>
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">운영 시간</label>
              <textarea
                rows={3}
                value={profileForm.operatingHours}
                onChange={(e) => setProfileForm((f) => ({ ...f, operatingHours: e.target.value }))}
                placeholder={'월~금  14:00 ~ 22:00\n토  10:00 ~ 18:00\n일  휴무'}
                className={clsx(fieldCls, 'resize-none')}
              />
            </div>
            <div>
              <label className="text-[11.5px] text-[#6b7280] block mb-1">환불 정책</label>
              <textarea
                rows={3}
                value={profileForm.refundPolicy}
                onChange={(e) => setProfileForm((f) => ({ ...f, refundPolicy: e.target.value }))}
                placeholder="수강 시작 후 1개월 이내 50% 환불..."
                className={clsx(fieldCls, 'resize-none')}
              />
            </div>
            <div className="flex items-center justify-between py-2 border-t border-[#f1f5f9]">
              <div>
                <div className="text-[12.5px] font-medium text-[#111827]">수강료 공개</div>
                <div className="text-[11px] text-[#9ca3af]">비활성 시 공개 페이지에서 수강료 숨김</div>
              </div>
              <div
                className={clsx('w-9 h-5 rounded-full relative cursor-pointer transition-colors', profileForm.showFees ? 'bg-[#4fc3a1]' : 'bg-[#e2e8f0]')}
                onClick={() => setProfileForm((f) => ({ ...f, showFees: !f.showFees }))}
              >
                <div className={clsx('absolute w-3.5 h-3.5 bg-white rounded-full top-[3px] transition-all', profileForm.showFees ? 'left-[19px]' : 'left-[3px]')} />
              </div>
            </div>
          </div>

          {/* 갤러리 */}
          <div className="bg-white rounded-[10px] border border-[#e2e8f0] p-4 space-y-3">
            <div className="text-[13px] font-semibold text-[#111827]">학원 사진 (최대 6장)</div>
            <p className="text-[11px] text-[#9ca3af]">사진을 선택하면 자동으로 최적화되어 업로드됩니다.</p>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => {
                const url = profileForm.galleryImages[i] ?? '';
                const isUploading = uploadingIndex === i;
                return (
                  <div
                    key={i}
                    className="relative aspect-[4/3] rounded-[8px] overflow-hidden border border-dashed border-[#e2e8f0] bg-[#f8fafc]"
                  >
                    {url ? (
                      <>
                        <img src={url} alt={`사진 ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                          onClick={() => deleteImage(i)}
                          className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70 cursor-pointer transition-colors"
                        >
                          <X size={10} className="text-white" />
                        </button>
                      </>
                    ) : (
                      <label className="w-full h-full flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-[#f1f5f9] transition-colors">
                        {isUploading ? (
                          <div className="w-5 h-5 border-2 border-[#4fc3a1] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Plus size={18} className="text-[#d1d5db]" />
                            <span className="text-[10px] text-[#9ca3af]">추가</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingIndex !== null}
                          onChange={(e) => handleImageUpload(e, i)}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 저장 버튼 */}
          <div className="flex justify-end pb-2">
            <Button variant="dark" size="md" onClick={saveProfile} disabled={profileSaving}>
              {profileSaving ? '저장 중...' : '공개 페이지 저장'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
