// src/components/charts/RPOGauge.jsx
import { formatRpo } from '@/constants/statusMaps';
import clsx from 'clsx';

const R   = 52;
const CX  = 70;
const CY  = 72;
const SW  = 10;

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx, cy, r, startAngle, endAngle) {
  const s    = polarToCartesian(cx, cy, r, startAngle);
  const e    = polarToCartesian(cx, cy, r, endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

const START_ANGLE = -210;
const END_ANGLE   = 30;

function rpoColor(ratio) {
  if (ratio === null || ratio === undefined) return { stroke: '#4a6080', text: 'text-text-muted' };
  if (ratio <= 0.75) return { stroke: '#10b981', text: 'text-ok' };
  if (ratio <= 1.0)  return { stroke: '#f59e0b', text: 'text-warn' };
  return { stroke: '#ef4444', text: 'text-crit' };
}

export default function RPOGauge({ actualSec, configuredSec, label = 'Actual RPO', size = 140 }) {
  const ratio = (actualSec && configuredSec) ? Math.min(actualSec / configuredSec, 1.5) : null;
  const { stroke, text } = rpoColor(ratio);

  const totalAngle = END_ANGLE - START_ANGLE;
  const fillAngle  = ratio !== null
    ? START_ANGLE + (Math.min(ratio, 1) * totalAngle)
    : START_ANGLE;

  const bgPath   = arcPath(CX, CY, R, START_ANGLE, END_ANGLE);
  const fillPath = ratio !== null ? arcPath(CX, CY, R, START_ANGLE, fillAngle) : null;

  const pct = ratio !== null ? Math.round(ratio * 100) : null;

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg
        viewBox="0 0 140 100"
        width={size}
        height={size * (100 / 140)}
        className="overflow-visible"
      >
        <path d={bgPath} fill="none" stroke="#1e2d47" strokeWidth={SW} strokeLinecap="round" />
        {fillPath && (
          <path d={fillPath} fill="none" stroke={stroke} strokeWidth={SW} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${stroke}60)`, transition: 'all 0.6s ease-out' }}
          />
        )}
        {fillPath && ratio !== null && (
          (() => {
            const tip = polarToCartesian(CX, CY, R, Math.min(fillAngle, END_ANGLE - 0.5));
            return (
              <circle cx={tip.x} cy={tip.y} r={4} fill={stroke}
                style={{ filter: `drop-shadow(0 0 6px ${stroke})` }} />
            );
          })()
        )}
        <text x={CX} y={CY - 6} textAnchor="middle"
          fill={stroke}
          fontSize={actualSec != null ? 18 : 14}
          fontFamily="JetBrains Mono, monospace"
          fontWeight="600"
        >
          {actualSec != null ? formatRpo(actualSec) : '—'}
        </text>
        {configuredSec && (
          <text x={CX} y={CY + 10} textAnchor="middle"
            fill="#4a6080" fontSize={8} fontFamily="JetBrains Mono, monospace">
            / {formatRpo(configuredSec)} target
          </text>
        )}
        {pct !== null && (
          <text x={CX} y={CY + 22} textAnchor="middle"
            fill={stroke} fontSize={9} fontFamily="JetBrains Mono, monospace">
            {pct > 100
              ? `${pct - 100}% over`
              : `${100 - pct}% headroom`}
          </text>
        )}
      </svg>
      <p className="section-title mt-1">{label}</p>
    </div>
  );
}
