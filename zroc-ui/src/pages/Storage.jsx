// src/pages/Storage.jsx
import { useQuery } from '@tanstack/react-query';
import { Database, HardDrive, Loader2 } from 'lucide-react';
import { queryDatastores } from '@/api/prometheusExtended';
import { formatBytes } from '@/constants/statusMaps';
import clsx from 'clsx';

const REFRESH = 60_000;

function CapacityBar({ label, usedBytes, totalBytes, color = 'bg-accent' }) {
  const pct = totalBytes > 0 ? Math.min(usedBytes / totalBytes, 1) : 0;
  const pctN = Math.round(pct * 100);
  const barColor = pct >= 0.9 ? 'bg-crit' : pct >= 0.75 ? 'bg-warn' : color;
  const textC = pct >= 0.9 ? 'text-crit' : pct >= 0.75 ? 'text-warn' : 'text-text-secondary';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-text-muted">{label}</span>
        <span className={clsx('font-mono data-value', textC)}>
          {formatBytes(usedBytes)} / {formatBytes(totalBytes)} ({pctN}%)
        </span>
      </div>
      <div className="h-2 bg-border rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all duration-500', barColor)} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

function ZertoUsageRow({ label, bytes, color }) {
  return bytes > 0 ? (
    <div className="flex items-center justify-between text-[10px]">
      <div className="flex items-center gap-1.5">
        <span className={clsx('w-2 h-2 rounded-sm flex-shrink-0', color)} />
        <span className="text-text-muted">{label}</span>
      </div>
      <span className="font-mono data-value text-text-secondary">{formatBytes(bytes)}</span>
    </div>
  ) : null;
}

function DatastoreCard({ ds }) {
  const usePct = ds.capacityBytes > 0 ? ds.usedBytes / ds.capacityBytes : 0;
  const alerting = usePct >= 0.9;
  const warning = usePct >= 0.75;
  const zertoUsed = (ds.journalBytes ?? 0) + (ds.scratchBytes ?? 0) + (ds.recoveryBytes ?? 0) + (ds.applianceBytes ?? 0);

  return (
    <div className={clsx('card p-4 space-y-4 transition-colors duration-300',
      alerting ? 'border-crit/30' : warning ? 'border-warn/20' : '')}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={clsx('w-8 h-8 rounded-md flex items-center justify-center',
            alerting ? 'bg-crit/10' : warning ? 'bg-warn/10' : 'bg-accent/10')}>
            <Database size={14} className={alerting ? 'text-crit' : warning ? 'text-warn' : 'text-accent'} />
          </div>
          <div>
            <p className="text-sm font-mono font-semibold text-text-primary truncate max-w-[180px]">{ds.name}</p>
            <p className="text-[10px] text-text-muted">{ds.siteName}</p>
          </div>
        </div>
        <div className="text-right text-[10px] text-text-muted font-mono">
          <p>{ds.vraCount ?? 0} VRA{(ds.vraCount ?? 0) !== 1 ? 's' : ''}</p>
          <p>{ds.incomingVms ?? 0} in / {ds.outgoingVms ?? 0} out</p>
        </div>
      </div>
      <CapacityBar label="Capacity" usedBytes={ds.usedBytes} totalBytes={ds.capacityBytes} />
      {zertoUsed > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-border">
          <p className="section-title mb-2">Zerto Usage ({formatBytes(zertoUsed)})</p>
          <ZertoUsageRow label="Journal" bytes={ds.journalBytes} color="bg-accent" />
          <ZertoUsageRow label="Scratch" bytes={ds.scratchBytes} color="bg-info" />
          <ZertoUsageRow label="Recovery" bytes={ds.recoveryBytes} color="bg-ok" />
          <ZertoUsageRow label="Appliances" bytes={ds.applianceBytes} color="bg-text-muted" />
        </div>
      )}
      <div className="flex justify-between text-[10px] text-text-muted pt-1 border-t border-border">
        <span>Free</span>
        <span className="font-mono data-value text-text-secondary">{formatBytes(ds.freeBytes)}</span>
      </div>
    </div>
  );
}

export default function Storage() {
  const { data: datastores = [], isLoading } = useQuery({
    queryKey: ['datastores'], queryFn: queryDatastores, refetchInterval: REFRESH,
  });

  const totalCapacity = datastores.reduce((s, d) => s + (d.capacityBytes ?? 0), 0);
  const totalUsed = datastores.reduce((s, d) => s + (d.usedBytes ?? 0), 0);
  const totalJournal = datastores.reduce((s, d) => s + (d.journalBytes ?? 0), 0);

  const bySite = {};
  for (const d of datastores) {
    const s = d.siteName || 'Unknown';
    if (!bySite[s]) bySite[s] = [];
    bySite[s].push(d);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Datastores', value: datastores.length, icon: Database },
          { label: 'Total Capacity', value: formatBytes(totalCapacity), icon: HardDrive },
          { label: 'Used', value: formatBytes(totalUsed), icon: HardDrive },
          { label: 'Journal Usage', value: formatBytes(totalJournal), icon: Database },
        ].map((s) => (
          <div key={s.label} className="card p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <s.icon size={16} className="text-accent" />
            </div>
            <div>
              <p className="section-title">{s.label}</p>
              <p className="font-mono text-lg font-semibold text-text-primary mt-0.5 data-value">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {totalCapacity > 0 && (
        <div className="card p-4">
          <CapacityBar label="Aggregate Capacity (all datastores)" usedBytes={totalUsed} totalBytes={totalCapacity} />
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-text-muted" />
        </div>
      )}

      {Object.entries(bySite).map(([site, siteDs]) => (
        <section key={site}>
          <p className="section-title mb-3">{site} · {siteDs.length} datastore{siteDs.length !== 1 ? 's' : ''}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {siteDs.map((ds) => <DatastoreCard key={ds.id || ds.name} ds={ds} />)}
          </div>
        </section>
      ))}

      {!isLoading && datastores.length === 0 && (
        <div className="card p-12 text-center">
          <Database size={28} className="text-text-muted mx-auto mb-3 opacity-40" />
          <p className="text-text-muted text-sm">No datastore data available</p>
        </div>
      )}
    </div>
  );
}
