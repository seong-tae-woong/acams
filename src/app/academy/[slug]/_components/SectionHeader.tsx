import { C, FONT } from '../_shared';

/* ─────────────────────────────────────────────────
   SectionHeader
───────────────────────────────────────────────── */
export default function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{
        fontSize: 19, fontWeight: 800, color: C.text,
        letterSpacing: '-0.4px', fontFamily: FONT, margin: 0,
      }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{ fontSize: 13, color: C.sub, marginTop: 4, fontFamily: FONT }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
