// src/pages/VRADashboard.jsx
import { useQuery } from '@tanstack/react-query';
import { Cpu, Server, HardDrive, Layers, Loader2 } from 'lucide-react';
import { queryAllVras } from '@/api/prometheusExtended';
import clsx from 'clsx';

const REFRESH = 30_000;
const VRA_MAX_VMS = 100;
const VRA_MAX_VOL = 2048;

function UsageBar({ label, used, total, max, unit = '', warnAt = 0.75, critAt = 0.9 }) {
  const pct = total > 0 ? Math.min(used / total, 1) : max > 0 ? Math.min(used / max, 1) : 0;
  const color = pct >= critAt ? 'bg-crit' : pct >= warnAt ? 'bg-warn' : 'bg-ok';
  const textC = pct >= critAt ? 'text-crit' : pct >= warnAt ? 'text-warn' : 'text-ok';
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-[10px]">
        <span className="text-text-muted">{label}</span>
        <span className={clsx('font-mono data-value', textC)}>
          {typeof used === 'number' ? `${Math.round(used)}${unit}` : '—'}
          {total > 0 ? ` / ${Math.round(total)}${unit}` : max ? ` / ${max}${unit}` : ''}
        </span>
      </div>
      <div className="h-1 bg-border rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

function WorkloadBadge({ label, value, icon: Icon, color = 'text-text-secondary' }) {
  return (
    <div className="flex flex-col items-center p-2 bg-canvas rounded-md border border-border min-w-0">
      <Icon size={12} className={clsx('mb-1', color)} />
      <span className={clsx('font-data text-base font-semibold data-value', color)}>{value ?? '—'}</span>
      <span className="section-title mt-0.5 text-center leading-tight">{label}</span>
    </div>
  );
}

function VraCard({ vra }) {
  const protPct = vra.protectedVms / VRA_MAX_VMS;
  const recPct = vra.recoveryVms / VRA_MAX_VMS;
  const alerting = protPct >= 0.9 || recPct >= 0.9;
  const warning = protPct >= 0.75 || recPct >= 0.75;

  return (
    <div className={clsx('card p-4 flex flex-col gap-4 transition-colors duration-300',
      alerting ? 'border-crit/30' : warning ? 'border-warn/30' : '')}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={clsx('w-8 h-8 rounded-md flex items-center justify-center',
            alerting ? 'bg-crit/10' : warning ? 'bg-warn/10' : 'bg-accent/10')}>
            <Server size={14} className={alerting ? 'text-crit' : warning ? 'text-warn' : 'text-accent'} />
          </div>
          <div>
            <p className="text-sm font-mono font-semibold text-text-primary truncate max-w-[140px]">{vra.name}</p>
            <p className="text-[10px] text-text-muted">{vra.siteName}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-text-muted font-mono">{vra.vcpuCount} vCPU</p>
          <p className="text-[10px] text-text-muted font-mono">{vra.memoryGb?.toFixed(0)} GB RAM</p>
        </div>
      </div>

      {(vra.cpuUsageMhz !== undefined || vra.memUsageMb !== undefined) && (
        <div className="space-y-2">
          {vra.cpuUsageMhz !== undefined && (
            <UsageBar label="CPU" used={vra.cpuUsageMhz} unit=" MHz" max={vra.vcpuCount * 2600} warnAt={0.7} critAt={0.9} />
          )}
          {vra.memUsageMb !== undefined && (
            <UsageBar label="Memory" used={vra.memUsageMb} total={(vra.memoryGb ?? 0) * 1024} unit=" MB" warnAt={0.8} critAt={0.92} />
          )}
        </div>
      )}

      <div>
        <p className="section-title mb-2">Workload</p>
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          <WorkloadBadge label="Prot VMs" value={vra.protectedVms} icon={Server}
            color={protPct >= 0.9 ? 'text-crit' : protPct >= 0.75 ? 'text-warn' : 'text-ok'} />
          <WorkloadBadge label="Rec VMs" value={vra.recoveryVms} icon={Server}
            color={recPct >= 0.9 ? 'text-crit' : recPct >= 0.75 ? 'text-warn' : 'text-accent'} />
          <WorkloadBadge label="Self VPGs" value={vra.selfProtectedVpgs} icon={Layers} color="text-text-secondary" />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <WorkloadBadge label="Prot Vols" value={vra.protectedVolumes} icon={HardDrive}
            color={vra.protectedVolumes / VRA_MAX_VOL >= 0.85 ? 'text-crit' : vra.protectedVolumes / VRA_MAX_VOL >= 0.7 ? 'text-warn' : 'text-text-secondary'} />
          <WorkloadBadge label="Rec Vols" value={vra.recoveryVolumes} icon={HardDrive}
            color={vra.recoveryVolumes / VRA_MAX_VOL >= 0.85 ? 'text-crit' : vra.recoveryVolumes / VRA_MAX_VOL >= 0.7 ? 'text-warn' : 'text-text-secondary'} />
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-text-muted font-mono pt-3 border-t border-border">
        <span>VRA {vra.version ?? '—'}</span>
        <span>ESXi {vra.hostVersion ?? '—'}</span>
      </div>
    </div>
  );
}

export default function VRADashboard() {
  const { data: vras = [], isLoading } = useQuery({
    queryKey: ['all-vras'], queryFn: queryAllVras, refetchInterval: REFRESH,
  });

  const bySite = {};
  for (const v of vras) {
    const s = v.siteName || 'Unknown';
    if (!bySite[s]) bySite[s] = [];
    bySite[s].push(v);
  }

  const totalProt = vras.reduce((s, v) => s + (v.protectedVms ?? 0), 0);
  const totalRec = vras.reduce((s, v) => s + (v.recoveryVms ?? 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total VRAs', value: vras.length },
          { label: 'Protected VMs', value: totalProt },
          { label: 'Recovery VMs', value: totalRec },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p className="font-data text-2xl font-semibold text-text-primary data-value">{s.value}</p>
            <p className="section-title mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-text-muted" /></div>
      )}

      {Object.entries(bySite).map(([site, siteVras]) => (
        <section key={site}>
          <p className="section-title mb-3">{site} · {siteVras.length} VRA{siteVras.length !== 1 ? 's' : ''}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {siteVras.map((vra) => <VraCard key={vra.id || vra.name} vra={vra} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
