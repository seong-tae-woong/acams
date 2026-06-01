'use client';
import { useState } from 'react';

export default function ConsultForm() {
  const [form, setForm] = useState({ name: '', phone: '', academyName: '', studentCount: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.phone.trim()) {
      setError('이름과 연락처는 필수입니다.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/intro/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? '신청에 실패했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }
      setDone(true);
    } catch {
      setError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="i-form">
        <div className="i-form-ok">
          <div className="ic">✓</div>
          <h3>신청이 접수되었습니다</h3>
          <p>담당자가 영업일 기준 1일 이내에 연락드리겠습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <form className="i-form" onSubmit={handleSubmit}>
      <p className="i-form-title">상담 신청</p>
      <p className="i-form-desc">연락처를 남겨주시면 데모 일정을 잡아드립니다.</p>

      <div className="i-field">
        <label htmlFor="cf-name">이름<span className="req">*</span></label>
        <input id="cf-name" className="i-input" value={form.name} onChange={set('name')} placeholder="홍길동" required />
      </div>
      <div className="i-field">
        <label htmlFor="cf-phone">연락처<span className="req">*</span></label>
        <input id="cf-phone" className="i-input" type="tel" value={form.phone} onChange={set('phone')} placeholder="010-1234-5678" required />
      </div>
      <div className="i-field">
        <label htmlFor="cf-academy">학원명</label>
        <input id="cf-academy" className="i-input" value={form.academyName} onChange={set('academyName')} placeholder="○○학원 (선택)" />
      </div>
      <div className="i-field">
        <label htmlFor="cf-count">학생 규모</label>
        <input id="cf-count" className="i-input" value={form.studentCount} onChange={set('studentCount')} placeholder="예: 30명 내외 (선택)" />
      </div>
      <div className="i-field">
        <label htmlFor="cf-message">문의 내용</label>
        <textarea id="cf-message" className="i-textarea" value={form.message} onChange={set('message')} placeholder="궁금한 점을 남겨주세요 (선택)" />
      </div>

      <button type="submit" className="i-submit" disabled={loading}>
        {loading ? '신청 중...' : '상담 신청하기'}
      </button>
      {error && <p className="i-form-err">{error}</p>}
    </form>
  );
}
