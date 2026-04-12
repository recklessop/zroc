// src/pages/Encryption.jsx
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, ShieldCheck, TrendingUp, AlertTriangle, Loader2 } from 'lucide-react';
import { queryEncryptionDetail } from '@/api/prometheusExtended';
import TimeSeriesChart from '@/components/charts/TimeSeriesChart';
import clsx from 'clsx';

const REFRESH = 30_000;

function EncryptionBar({ pct }) {
  const enc = Math.min(pct ?? 0, 100);
  const color = enc > 80 ? 'bg-crit' : enc > 50 ? 'bg-warn' : 'bg-ok';
  const textC = enc > 80 ? 'text-crit' : enc > 50 ? 'text-warn' : 'text-ok';
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-border rounded-full overflow-hidden flex">
        <div className={clsx('h-full transition-all duration-500', color)} style={{ width: `${enc}%` }} />
      </div>
      <span className={clsx('font-mono text-xs data-value w-12 text-right flex-shrink-0', textC)}>
        {enc.toFixed(1)}%
      </span>
    </div>
  );
}

function TrendBadge({ level }) {
  const l = level ?? 0;
  if (l === 0) return <span className="badge badge-ok">Stable</span>;
  if (l === 1) return <span className="badge badge-warn">Rising</span>;
  return <span className="badge badge-crit">Spike</span>;
}

export default function EncryptionPage() {
  const { data: vms = [], isLoading } = useQuery({
    queryKey: ['encryption-detail'],
    queryFn: queryEncryptionDetail,
    refetchInterval: REFRESH,
  });

  const anomalies = vms.filter((v) => (v.pctEncrypted ?? 0) > 50);
  const highAlert = vms.filter((v) => (v.pctEncrypted ?? 0) > 80);
  const avgPct = vms.length ? vms.reduce((s, v) => s + (v.pctEncrypted ?? 0), 0) / vms.length : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'VMs Monitored', value: vms.length, icon: ShieldAlert, color: 'accent' },
          { label: 'Anomalies (>50%)', value: anomalies.length, icon: AlertTriangle, color: anomalies.length ? 'warn' : 'ok' },
          { label: 'High Alert (>80%)', value: highAlert.length, icon: TrendingUp, color: highAlert.length ? 'crit' : 'ok' },
          { label: 'Avg Encryption', value: `${avgPct.toFixed(1)}%`, icon: ShieldCheck, color: avgPct > 60 ? 'warn' : 'ok' },
        ].map((s) => (
          <div key={s.label} className="card p-4 flex items-start gap-3">
            <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center',
              s.color === 'ok' && 'bg-ok/10', s.color === 'warn' && 'bg-warn/10',
              s.color === 'crit' && 'bg-crit/10', s.color === 'accent' && 'bg-accent/10')}>
              <s.icon size={16} className={clsx(
                s.color === 'ok' && 'text-ok', s.color === 'warn' && 'text-warn',
                s.color === 'crit' && 'text-crit', s.color === 'accent' && 'text-accent')} />
            </div>
            <div>
              <p className="section-title">{s.label}</p>
              <p className="font-data text-xl font-semibold text-text-primary data-value mt-0.5">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {anomalies.length > 0 && (
        <TimeSeriesChart
          title="Encryption % Over Time — Top Anomalies"
          promql={`vm_PercentEncrypted{VmName="${anomalies[0]?.name?.replace(/"/g, '\\"')}"}`}
          yFormatter={(v) => `${v.toFixed(1)}%`}
          refLines={[{ value: 80, label: 'High alert', color: 'crit' }, { value: 50, label: 'Warning', color: 'warn' }]}
          transform={(result) => result[0]?.values.map(([ts, v]) => ({ ts: ts * 1000, 'Encrypted %': parseFloat(v) })) ?? []}
          height={180}
        />
      )}

      <section>
        <p className="section-title mb-3">VM Encryption Status</p>
        <div className="card overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 text-left section-title">VM</th>
                <th className="px-4 py-2.5 text-left section-title">VPG</th>
                <th className="px-4 py-2.5 text-left section-title">Encryption %</th>
                <th className="px-4 py-2.5 text-left section-title hidden md:table-cell">Trend</th>
                <th className="px-4 py-2.5 text-right section-title hidden lg:table-cell">IO Ops</th>
                <th className="px-4 py-2.5 text-right section-title hidden lg:table-cell">Write</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="py-10 text-center">
                  <Loader2 size={16} className="animate-spin text-text-muted mx-auto" />
                </td></tr>
              )}
              {!isLoading && vms.map((vm) => (
                <tr key={vm.id} className="border-b border-border/40 last:border-0 hover:bg-raised transition-colors">
                  <td className="px-4 py-2.5 font-medium text-text-primary">{vm.name}</td>
                  <td className="px-4 py-2.5 text-text-muted">{vm.vpgName}</td>
                  <td className="px-4 py-2.5 min-w-[160px]"><EncryptionBar pct={vm.pctEncrypted} /></td>
                  <td className="px-4 py-2.5 hidden md:table-cell"><TrendBadge level={vm.trendLevel} /></td>
                  <td className="px-4 py-2.5 text-right hidden lg:table-cell">
                    <span className="font-mono data-value text-text-secondary">
                      {vm.ioOps != null ? Math.round(vm.ioOps).toLocaleString() : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right hidden lg:table-cell">
                    <span className="font-mono data-value text-text-secondary">
                      {vm.writeMb != null ? `${vm.writeMb.toFixed(2)} MB` : '—'}
                    </span>
                  </td>
                </tr>
              ))}
              {!isLoading && vms.length === 0 && (
                <tr><td colSpan={6} className="py-12 text-center">
                  <ShieldCheck size={24} className="text-ok mx-auto mb-2" />
                  <p className="text-text-muted">No encryption stats available</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
