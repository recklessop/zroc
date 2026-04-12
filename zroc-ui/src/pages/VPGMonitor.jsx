// src/pages/VPGMonitor.jsx
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronRight, Loader2 } from 'lucide-react';
import { queryAllVpgs } from '@/api/prometheus';
import { queryVpgDetail, queryVpgVms } from '@/api/prometheusExtended';
import TimeSeriesChart from '@/components/charts/TimeSeriesChart';
import RPOGauge from '@/components/charts/RPOGauge';
import { VPG_ALERT, vpgHealth, rpoStatus, formatRpo, formatMB, colorToText } from '@/constants/statusMaps';
import clsx from 'clsx';

const REFRESH = 30_000;

function VpgListItem({ vpg, selected, onClick }) {
  const status = rpoStatus(vpg.actualRpoSec, vpg.configuredRpoSec);
  return (
    <button onClick={onClick} className={clsx('w-full text-left px-3 py-2.5 rounded-md transition-all duration-150 group',
      selected ? 'bg-accent/15 border border-accent/25' : 'hover:bg-raised border border-transparent')}>
      <div className="flex items-center gap-2">
        <span className={clsx('status-dot flex-shrink-0',
          status === 'ok' ? 'status-dot-ok' : status === 'warn' ? 'status-dot-warn' : status === 'crit' ? 'status-dot-crit' : 'status-dot-idle')} />
        <span className={clsx('text-sm font-medium truncate flex-1', selected ? 'text-accent' : 'text-text-primary')}>{vpg.name}</span>
        {selected && <ChevronRight size={12} className="text-accent flex-shrink-0" />}
      </div>
      <div className="flex items-center gap-3 mt-0.5 pl-4">
        <span className="text-[10px] text-text-muted">{vpg.siteName}</span>
        <span className={clsx('text-[10px] font-mono data-value', colorToText[status])}>{formatRpo(vpg.actualRpoSec)}</span>
      </div>
    </button>
  );
}

function VpgDetail({ vpgName }) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ['vpg-detail', vpgName], queryFn: () => queryVpgDetail(vpgName), refetchInterval: REFRESH, enabled: !!vpgName,
  });
  const { data: vms = [], isLoading: vmsLoading } = useQuery({
    queryKey: ['vpg-vms', vpgName], queryFn: () => queryVpgVms(vpgName), refetchInterval: REFRESH, enabled: !!vpgName,
  });

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-text-muted" /></div>;
  if (!detail) return null;

  const alertInfo = VPG_ALERT[detail.alertStatus] ?? VPG_ALERT[0];
  const esc = vpgName.replace(/"/g, '\\"');

  return (
    <div className="flex-1 min-w-0 overflow-y-auto p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-1">
        <span className={clsx('status-dot', alertInfo.color === 'ok' ? 'status-dot-ok' : alertInfo.color === 'warn' ? 'status-dot-warn' : 'status-dot-crit')} />
        <h2 className="font-mono text-base font-semibold text-text-primary">{vpgName}</h2>
        <span className={clsx('badge', `badge-${alertInfo.color}`)}>{alertInfo.label}</span>
        <span className="text-xs text-text-muted">{detail.siteName} · {detail.vmCount} VMs</span>
      </div>

      <div className="card overflow-hidden flex flex-wrap">
        <div className="flex items-center justify-center p-4 border-r border-border">
          <RPOGauge actualSec={detail.actualRpoSec} configuredSec={detail.configuredRpoSec} size={150} />
        </div>
        <div className="flex flex-wrap flex-1">
          {[
            { label: 'Throughput', value: `${(detail.throughputMb ?? 0).toFixed(2)} MB/s` },
            { label: 'IOPS', value: Math.round(detail.iops ?? 0) },
            { label: 'Storage', value: formatMB(detail.storageUsedMb) },
          ].map((s) => (
            <div key={s.label} className="text-center px-4 py-3 border-r border-border last:border-0">
              <p className="text-lg font-semibold font-data data-value text-text-primary">{s.value}</p>
              <p className="section-title mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <TimeSeriesChart title="RPO Over Time" promql={`vpg_actual_rpo{VpgName="${esc}"}`}
        yFormatter={(v) => formatRpo(v)}
        refLines={detail.configuredRpoSec ? [{ value: detail.configuredRpoSec, label: 'Target', color: 'warn' }] : []}
        transform={(result) => result[0]?.values.map(([ts, v]) => ({ ts: ts * 1000, 'RPO (s)': parseFloat(v) })) ?? []}
        height={180} />

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border"><p className="section-title">Protected VMs</p></div>
        <table className="w-full text-xs">
          <thead><tr className="border-b border-border/60">
            <th className="px-4 py-2 text-left section-title">VM Name</th>
            <th className="px-4 py-2 text-right section-title">RPO</th>
            <th className="px-4 py-2 text-right section-title hidden sm:table-cell">Throughput</th>
            <th className="px-4 py-2 text-right section-title hidden md:table-cell">IOPS</th>
          </tr></thead>
          <tbody>
            {vmsLoading && <tr><td colSpan={4} className="py-8 text-center"><Loader2 size={16} className="animate-spin text-text-muted mx-auto" /></td></tr>}
            {!vmsLoading && vms.map((vm) => (
              <tr key={vm.id} className="border-b border-border/40 last:border-0 hover:bg-raised transition-colors">
                <td className="px-4 py-2 font-medium text-text-primary">{vm.name}</td>
                <td className="px-4 py-2 text-right font-mono data-value">{formatRpo(vm.actualRpoSec)}</td>
                <td className="px-4 py-2 text-right text-text-secondary font-mono data-value hidden sm:table-cell">{vm.throughputMb?.toFixed(2)} MB/s</td>
                <td className="px-4 py-2 text-right text-text-secondary font-mono data-value hidden md:table-cell">{Math.round(vm.iops ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function VPGMonitor() {
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const initialName = params.get('name');

  const { data: vpgs = [], isLoading } = useQuery({
    queryKey: ['all-vpgs'], queryFn: queryAllVpgs, refetchInterval: REFRESH,
  });

  const [selected, setSelected] = useState(initialName || null);

  useEffect(() => {
    if (!selected && vpgs.length > 0) setSelected(vpgs[0].name);
  }, [vpgs, selected]);

  const filtered = vpgs.filter((v) => !search || v.name.toLowerCase().includes(search.toLowerCase()));

  const bySite = {};
  for (const v of filtered) { const s = v.siteName || 'Unknown'; if (!bySite[s]) bySite[s] = []; bySite[s].push(v); }

  return (
    <div className="flex h-full -m-6 overflow-hidden">
      <aside className="w-64 flex-shrink-0 border-r border-border flex flex-col bg-surface overflow-hidden">
        <div className="p-3 border-b border-border flex-shrink-0">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input className="field pl-8 text-xs py-1.5" placeholder="Filter VPGs…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <p className="text-[10px] text-text-muted mt-2 font-mono">{filtered.length} VPGs</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading && <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-text-muted" /></div>}
          {Object.entries(bySite).map(([site, siteVpgs]) => (
            <div key={site} className="mb-3">
              <p className="section-title px-2 mb-1">{site}</p>
              {siteVpgs.map((v) => <VpgListItem key={v.id} vpg={v} selected={selected === v.name} onClick={() => setSelected(v.name)} />)}
            </div>
          ))}
        </div>
      </aside>
      <div className="flex-1 flex flex-col overflow-hidden">
        {selected ? <VpgDetail vpgName={selected} /> : (
          <div className="flex-1 flex items-center justify-center text-text-muted text-sm">Select a VPG to view details</div>
        )}
      </div>
    </div>
  );
}
