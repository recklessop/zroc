// src/pages/VMDetail.jsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Server, X, Activity, Loader2 } from 'lucide-react';
import { queryAllVms } from '@/api/prometheusExtended';
import TimeSeriesChart from '@/components/charts/TimeSeriesChart';
import RPOGauge from '@/components/charts/RPOGauge';
import { VM_STATUS, formatRpo, formatMB } from '@/constants/statusMaps';
import clsx from 'clsx';

const REFRESH = 30_000;

function JournalGauge({ usedMb, hardLimitMb }) {
  if (!hardLimitMb || hardLimitMb <= 0) return <span className="text-xs text-text-muted">—</span>;
  const pct = Math.min(usedMb / hardLimitMb, 1);
  const color = pct > 0.85 ? 'bg-crit' : pct > 0.65 ? 'bg-warn' : 'bg-ok';
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full', color)} style={{ width: `${pct * 100}%` }} />
      </div>
      <span className="text-[10px] font-mono data-value text-text-muted whitespace-nowrap">{formatMB(usedMb)}</span>
    </div>
  );
}

function VmDrawer({ vm, onClose }) {
  const esc = vm.name.replace(/"/g, '\\"');
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-panel">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Server size={18} className="text-accent" />
            </div>
            <div>
              <p className="font-mono text-sm font-semibold text-text-primary">{vm.name}</p>
              <p className="text-xs text-text-muted">{vm.vpgName} · {vm.siteName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-raised transition-colors"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="card p-4 flex items-start gap-6">
            <RPOGauge actualSec={vm.actualRpoSec} size={120} label="Current RPO" />
            <div className="flex-1 space-y-2 pt-2">
              {[
                { label: 'Throughput', value: `${(vm.throughputMb ?? 0).toFixed(2)} MB/s` },
                { label: 'IOPS', value: Math.round(vm.iops ?? 0).toLocaleString() },
                { label: 'Bandwidth', value: `${(vm.bandwidthMbps ?? 0).toFixed(2)} Mbps` },
                { label: 'Journal', value: formatMB(vm.journalUsedMb) },
                { label: 'Encryption', value: vm.pctEncrypted != null ? `${vm.pctEncrypted.toFixed(1)}%` : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-text-muted">{label}</span>
                  <span className="font-mono data-value text-text-primary">{value}</span>
                </div>
              ))}
            </div>
          </div>
          <TimeSeriesChart title="RPO History" promql={`vm_actualrpo{VmName="${esc}"}`}
            yFormatter={formatRpo}
            transform={(result) => result[0]?.values.map(([ts, v]) => ({ ts: ts * 1000, 'RPO': parseFloat(v) })) ?? []}
            height={170} />
          <TimeSeriesChart title="Throughput" promql={`vm_throughput_in_mb{VmName="${esc}"}`}
            yFormatter={(v) => `${v.toFixed(1)} MB/s`}
            transform={(result) => result[0]?.values.map(([ts, v]) => ({ ts: ts * 1000, 'MB/s': parseFloat(v) })) ?? []}
            height={150} />
        </div>
      </div>
    </>
  );
}

function VmStatusBadge({ code }) {
  const s = VM_STATUS[code] ?? { label: 'Unknown', color: 'muted' };
  return <span className={clsx('badge', `badge-${s.color === 'muted' ? 'muted' : s.color}`)}>{s.label}</span>;
}

export default function VMDetail() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('rpo-desc');
  const [selected, setSelected] = useState(null);

  const { data: vms = [], isLoading } = useQuery({
    queryKey: ['all-vms'], queryFn: queryAllVms, refetchInterval: REFRESH,
  });

  const filtered = vms.filter((v) => {
    const q = search.toLowerCase();
    return !q || v.name?.toLowerCase().includes(q) || v.vpgName?.toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case 'rpo-desc': return (b.actualRpoSec ?? 0) - (a.actualRpoSec ?? 0);
      case 'rpo-asc': return (a.actualRpoSec ?? 0) - (b.actualRpoSec ?? 0);
      case 'name-asc': return (a.name ?? '').localeCompare(b.name ?? '');
      default: return 0;
    }
  });

  return (
    <div className="flex flex-col h-full space-y-4 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total VMs', value: vms.length, color: 'accent' },
          { label: 'RPO OK', value: vms.filter((v) => (v.actualRpoSec ?? 0) <= 300).length, color: 'ok' },
          { label: 'RPO Warning', value: vms.filter((v) => (v.actualRpoSec ?? 0) > 300 && (v.actualRpoSec ?? 0) <= 600).length, color: 'warn' },
          { label: 'RPO Critical', value: vms.filter((v) => (v.actualRpoSec ?? 0) > 600).length, color: 'crit' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4 flex items-start gap-3">
            <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', `bg-${color}/10`)}>
              <Activity size={16} className={`text-${color}`} />
            </div>
            <div><p className="section-title">{label}</p><p className="font-data text-2xl font-semibold text-text-primary data-value">{value}</p></div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input className="field pl-8 text-sm" placeholder="Search VMs or VPGs…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="field w-auto text-sm" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="rpo-desc">RPO (worst first)</option>
          <option value="rpo-asc">RPO (best first)</option>
          <option value="name-asc">Name A-Z</option>
        </select>
        <span className="text-xs text-text-muted">{sorted.length} / {vms.length} VMs</span>
      </div>

      <div className="card flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border">
            <th className="px-4 py-3 text-left section-title">VM Name</th>
            <th className="px-4 py-3 text-left section-title hidden md:table-cell">VPG</th>
            <th className="px-4 py-3 text-right section-title">RPO</th>
            <th className="px-4 py-3 text-left section-title hidden md:table-cell">Journal</th>
            <th className="px-4 py-3 text-right section-title hidden lg:table-cell">Throughput</th>
            <th className="px-4 py-3 text-left section-title hidden xl:table-cell">Status</th>
          </tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="py-16 text-center"><Loader2 size={20} className="animate-spin text-text-muted mx-auto" /></td></tr>}
            {!isLoading && sorted.length === 0 && <tr><td colSpan={6} className="py-16 text-center text-text-muted">No VMs</td></tr>}
            {!isLoading && sorted.map((vm) => {
              const rpoColor = vm.actualRpoSec > 600 ? 'text-crit' : vm.actualRpoSec > 300 ? 'text-warn' : 'text-ok';
              return (
                <tr key={vm.id} onClick={() => setSelected(vm)} className="table-row-hover border-b border-border/40 last:border-0">
                  <td className="px-4 py-3"><span className="font-medium text-text-primary truncate">{vm.name}</span></td>
                  <td className="px-4 py-3 hidden md:table-cell"><span className="text-text-muted text-xs">{vm.vpgName}</span></td>
                  <td className="px-4 py-3 text-right"><span className={clsx('font-mono font-semibold text-xs data-value', rpoColor)}>{formatRpo(vm.actualRpoSec)}</span></td>
                  <td className="px-4 py-3 hidden md:table-cell"><JournalGauge usedMb={vm.journalUsedMb} hardLimitMb={vm.journalHardLimit} /></td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell"><span className="font-mono text-xs data-value text-text-secondary">{(vm.throughputMb ?? 0).toFixed(2)} MB/s</span></td>
                  <td className="px-4 py-3 hidden xl:table-cell"><VmStatusBadge code={vm.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && <VmDrawer vm={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
