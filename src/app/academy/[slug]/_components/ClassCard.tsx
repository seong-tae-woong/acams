import { ChevronRight } from 'lucide-react';
import { type ClassItem, C, FONT, feeUnit } from '../_shared';
import Row from './Row';

/* ─────────────────────────────────────────────────
   ClassCard — 인보이스 스타일 수업 카드
───────────────────────────────────────────────── */
export default function ClassCard({ cls, showFee, onClick }: { cls: ClassItem; showFee: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: C.card, borderRadius: 16, boxShadow: C.shadow,
        overflow: 'hidden', fontFamily: FONT, display: 'flex', flexDirection: 'column',
        textAlign: 'left', border: 'none', cursor: onClick ? 'pointer' : 'default',
        padding: 0, width: '100%', transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => { if (onClick) (e.currentTarget.style.boxShadow = C.shadowMd); }}
      onMouseLeave={(e) => { if (onClick) (e.currentTarget.style.boxShadow = C.shadow); }}
    >
      {/* 컬러 상단 바 */}
      <div style={{ height: 4, background: cls.color, flexShrink: 0, width: '100%' }} />

      <div style={{ padding: '16px 18px 18px', flex: 1, display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box' }}>
        {/* 수업명 + 수강료 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: '-0.3px', lineHeight: 1.3 }}>
            {cls.name}
          </p>
          {showFee && cls.fee !== null && (
            <span style={{
              fontSize: 16, fontWeight: 800, color: C.accent,
              whiteSpace: 'nowrap', letterSpacing: '-0.4px',
            }}>
              {cls.fee.toLocaleString()}원
            </span>
          )}
        </div>

        {/* 상세 정보 */}
        <div style={{
          borderTop: `1px solid ${C.border}`, paddingTop: 10,
          display: 'flex', flexDirection: 'column', gap: 6, flex: 1,
        }}>
          {(cls.subject || cls.grade) && (
            <Row label="과목" value={`${cls.subject}${cls.grade ? ` · ${cls.grade}` : ''}`} />
          )}
          {cls.schedule && <Row label="일정" value={cls.schedule} />}
          {showFee && cls.fee !== null && (
            <Row label="수강료" value={`${cls.fee.toLocaleString()}원 / ${feeUnit(cls.feeType)}`} bold />
          )}
        </div>
        {onClick && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: C.accent, fontWeight: 600 }}>
            상세 보기 <ChevronRight size={12} />
          </div>
        )}
      </div>
    </button>
  );
}
