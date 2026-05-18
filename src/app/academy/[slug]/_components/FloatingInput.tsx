'use client';
import { useState } from 'react';
import { C, FONT } from '../_shared';

/* ─────────────────────────────────────────────────
   FloatingInput — label이 위로 올라가는 입력 필드
───────────────────────────────────────────────── */
export default function FloatingInput({
  label, type = 'text', value, onChange, required,
}: {
  label: string; type?: string; value: string;
  onChange: (v: string) => void; required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const lifted = focused || value.length > 0;

  return (
    <div style={{ position: 'relative' }}>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        required={required}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '20px 16px 8px', fontSize: 14,
          borderRadius: 12, border: `2px solid ${focused ? C.accent : C.border}`,
          outline: 'none', fontFamily: FONT, color: C.text, background: C.card,
          boxShadow: focused ? `0 0 0 3px ${C.accentLight}` : 'none',
          transition: 'border-color 0.18s, box-shadow 0.18s',
        }}
      />
      <label
        style={{
          position: 'absolute', left: 16, pointerEvents: 'none',
          top: lifted ? 7 : 14,
          fontSize: lifted ? 11 : 14,
          fontWeight: lifted ? 600 : 400,
          color: focused ? C.accent : lifted ? C.sub : C.muted,
          fontFamily: FONT,
          transition: 'all 0.18s',
        }}
      >
        {label}{required && <span style={{ color: C.accent }}> *</span>}
      </label>
    </div>
  );
}
