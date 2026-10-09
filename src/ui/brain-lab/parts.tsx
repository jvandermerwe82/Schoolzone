import type { ReactNode } from 'react';
import { sourceInfo, type DataSource } from '../../brain-view/provenance';
import type { StatusTone } from '../../brain-view/views';

export const pct = (n: number | null | undefined, digits = 0) =>
  n === null || n === undefined ? 'n/a' : `${(n * 100).toFixed(digits)}%`;
export const num = (n: number, digits = 2) => n.toFixed(digits);

export function SourceBadge({ source }: { source: DataSource }) {
  const info = sourceInfo(source);
  return (
    <span className={`bl-source ${source}`} title={info.description}>
      {info.label}
    </span>
  );
}

export function Card({
  title, source, children, wide = false, id,
}: { title: string; source: DataSource; children: ReactNode; wide?: boolean; id?: string }) {
  return (
    <section className={`bl-card${wide ? ' wide' : ''}`} aria-labelledby={id ? `${id}-h` : undefined} id={id}>
      <header className="bl-card-head">
        <h3 id={id ? `${id}-h` : undefined}>{title}</h3>
        <SourceBadge source={source} />
      </header>
      {children}
    </section>
  );
}

export function StatusPill({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return <span className={`bl-pill tone-${tone}`}>{children}</span>;
}

export function Meter({ value, label, tone = 'blue', marker }: { value: number; label: string; tone?: 'blue' | 'green' | 'amber' | 'grey'; marker?: number | null }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className="bl-meter" role="img" aria-label={label}>
      <span className={`bl-meter-fill ${tone}`} style={{ width: `${clamped * 100}%` }} />
      {marker !== null && marker !== undefined && <span className="bl-meter-marker" style={{ left: `${marker * 100}%` }} />}
    </div>
  );
}

export function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="bl-row">
      <dt>{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}
