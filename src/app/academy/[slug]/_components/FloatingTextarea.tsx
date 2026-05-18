'use client';
import { useState } from 'react';
import { C, FONT } from '../_shared';

/* ─────────────────────────────────────────────────
   FloatingTextarea
───────────────────────────────────────────────── */
export default function FloatingTextarea({
  label, value, onChange,
}: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const lifted = focused || value.length > 0;

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        rows={4}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '24px 16px 10px', fontSize: 14,
          borderRadius: 12, border: `2px solid ${focused ? C.accent : C.border}`,
          outline: 'none', fontFamily: FONT, color: C.text, background: C.card,
          resize: 'none',
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
        {label}
      </label>
    </div>
  );
}
