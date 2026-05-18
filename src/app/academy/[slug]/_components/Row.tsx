import { C } from '../_shared';

export default function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <span style={{ fontSize: 12, color: C.muted, minWidth: 36, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: bold ? C.text : C.sub, fontWeight: bold ? 600 : 400 }}>{value}</span>
    </div>
  );
}
