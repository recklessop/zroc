// src/components/charts/TimeSeriesChart.jsx
import { useState, useCallback } from 'react';
import {
  ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useRangeQuery } from '@/hooks/useRangeQuery';
import { Loader2 } from 'lucide-react';
import clsx from 'clsx';

const WINDOWS = ['1h', '6h', '24h', '7d', '30d'];

function CustomTooltip({ active, payload, label, formatter, timeFormat }) {
  if (!active || !payload?.length) return null;
  const ts = typeof label === 'number' ? new Date(label).toLocaleString(undefined, timeFormat) : label;
  return (
    <div className="bg-raised border border-border-bright rounded-lg px-3 py-2 shadow-panel text-xs">
      <p className="text-text-muted font-mono mb-2">{ts}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-text-secondary">{p.name}:</span>
          <span className="font-mono font-semibold text-text-primary">
            {formatter ? formatter(p.value, p.dataKey) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function WindowSelector({ value, onChange }) {
  return (
    <div className="flex items-center gap-0.5 bg-canvas rounded-md p-0.5 border border-border">
      {WINDOWS.map((w) => (
        <button key={w} onClick={() => onChange(w)}
          className={clsx('px-2.5 py-1 rounded text-xs font-mono transition-all duration-150',
            value === w ? 'bg-accent/20 text-accent border border-accent/30' : 'text-text-muted hover:text-text-primary hover:bg-raised')}>
          {w}
        </button>
      ))}
    </div>
  );
}

const SERIES_COLORS = {
  ok: '#10b981', warn: '#f59e0b', crit: '#ef4444', accent: '#0ea5e9',
  info: '#818cf8', 0: '#0ea5e9', 1: '#10b981', 2: '#f59e0b', 3: '#818cf8', 4: '#ef4444',
};

export default function TimeSeriesChart({
  promql, title, yFormatter, yLabel, refLines = [],
  showWindow = true, defaultWindow = '6h', height = 200, transform, series: seriesDef,
}) {
  const [window, setWindow] = useState(defaultWindow);

  const seriesArr = seriesDef ? seriesDef
    : Array.isArray(promql) ? promql
    : [{ promql, name: title || 'value', color: 'accent' }];

  const primaryPromql = typeof promql === 'string' ? promql : seriesArr[0]?.promql;

  const { data: rawData, isLoading, error } = useRangeQuery(primaryPromql, {
    window, enabled: !!primaryPromql,
  });

  const chartData = useCallback(() => {
    if (!rawData?.length) return [];
    if (transform) return transform(rawData, window);
    const merged = {};
    rawData.forEach((series, si) => {
      const key = series.metric.VpgName || series.metric.VmName || series.metric.VraName || seriesArr[si]?.name || `series${si}`;
      series.values.forEach(([ts, v]) => {
        const ms = ts * 1000;
        if (!merged[ms]) merged[ms] = { ts: ms };
        merged[ms][key] = parseFloat(v);
      });
    });
    return Object.values(merged).sort((a, b) => a.ts - b.ts);
  }, [rawData, transform, window, seriesArr]);

  const data = chartData();
  const seriesKeys = data.length > 0 ? Object.keys(data[0]).filter((k) => k !== 'ts') : [];

  const makeTimeTick = (w) => (ts) => {
    const d = new Date(ts);
    if (w === '30d' || w === '7d') return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  const makeTooltipTimeFormat = (w) => {
    if (w === '30d' || w === '7d') return { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return { hour: '2-digit', minute: '2-digit', second: '2-digit' };
  };

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        {title && <p className="section-title">{title}</p>}
        {showWindow && <WindowSelector value={window} onChange={setWindow} />}
      </div>
      <div style={{ height }} className="relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={18} className="animate-spin text-text-muted" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-crit font-mono">Query failed</p>
          </div>
        )}
        {!isLoading && !error && data.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-text-muted font-mono">No data</p>
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 4, left: yLabel ? 16 : 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,71,0.8)" vertical={false} />
            <XAxis dataKey="ts" type="number" domain={['dataMin', 'dataMax']}
              tickFormatter={makeTimeTick(window)}
              tick={{ fontSize: 10, fill: '#4a6080', fontFamily: 'JetBrains Mono' }}
              axisLine={{ stroke: '#1e2d47' }} tickLine={false} scale="time" />
            <YAxis tickFormatter={(v) => yFormatter ? yFormatter(v) : v}
              tick={{ fontSize: 10, fill: '#4a6080', fontFamily: 'JetBrains Mono' }}
              axisLine={false} tickLine={false} width={yLabel ? 60 : 40} />
            <Tooltip content={<CustomTooltip formatter={yFormatter} timeFormat={makeTooltipTimeFormat(window)} />}
              cursor={{ stroke: '#2a4066', strokeWidth: 1, strokeDasharray: '4 2' }} />
            {refLines.map((rl) => (
              <ReferenceLine key={rl.label} y={rl.value}
                stroke={SERIES_COLORS[rl.color] || rl.color || '#f59e0b'}
                strokeDasharray="6 3" strokeWidth={1.5} />
            ))}
            {(seriesArr.length > 1 ? seriesArr : seriesKeys.map((k, i) => ({
              name: k, color: i, type: 'area',
            }))).map((s, i) => {
              const key = s.name || s.promql || seriesKeys[i] || `s${i}`;
              const color = SERIES_COLORS[s.color] || SERIES_COLORS[i] || '#0ea5e9';
              return (
                <Area key={key} type="monotone" dataKey={key} name={s.name || key}
                  stroke={color} strokeWidth={2} fill={color} fillOpacity={0.08}
                  dot={false} activeDot={{ r: 3 }} connectNulls />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
