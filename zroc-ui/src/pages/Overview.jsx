// src/pages/Overview.jsx
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, AlertTriangle, XCircle, Activity } from 'lucide-react';
import { queryOverviewSummary, queryAllVpgs, queryTopRpoViolators, queryExporterHealth } from '@/api/prometheus';
import { rpoStatus, formatRpo, colorToText } from '@/constants/statusMaps';
import clsx from 'clsx';

const REFRESH = 30_000;

function StatCard({ label, value, sub, color = 'accent', icon: Icon }) {
  return (
    <div className="card p-4 flex items-start gap-4">
      <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
        `bg-${color}/10`)}>
        <Icon size={18} className={`text-${color}`} />
      </div>
      <div className="min-w-0">
        <p className="section-title">{label}</p>
        <p className="font-data text-2xl font-semibold text-text-primary mt-0.5 data-value">{value ?? '—'}</p>
        {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SiteCard({ site }) {
  const hasCrit = site.crit > 0;
  return (
    <div className={clsx('card p-4 border transition-colors duration-300',
      hasCrit ? 'border-crit/30' : site.warn > 0 ? 'border-warn/30' : 'border-border')}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={clsx('status-dot', hasCrit ? 'status-dot-crit' : site.warn > 0 ? 'status-dot-warn' : 'status-dot-ok')} />
          <p className="font-mono text-sm font-semibold text-text-primary">{site.siteName}</p>
        </div>
        <span className={clsx('badge text-xs', hasCrit ? 'badge-crit' : site.warn > 0 ? 'badge-warn' : 'badge-ok')}>
          {hasCrit ? 'Alert' : site.warn > 0 ? 'Warning' : 'Healthy'}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div><p className="font-data text-xl font-semibold text-ok data-value">{site.ok}</p><p className="section-title">OK</p></div>
        <div><p className="font-data text-xl font-semibold text-warn data-value">{site.warn}</p><p className="section-title">Warn</p></div>
        <div><p className="font-data text-xl font-semibold text-crit data-value">{site.crit}</p><p className="section-title">Crit</p></div>
      </div>
    </div>
  );
}

function VpgTile({ vpg, onClick }) {
  const status = rpoStatus(vpg.actualRpoSec, vpg.configuredRpoSec);
  return (
    <button onClick={onClick}
      title={`${vpg.name}\nRPO: ${formatRpo(vpg.actualRpoSec)}`}
      className={clsx('relative p-2 rounded-md border text-left transition-all duration-200 hover:scale-105 hover:z-10',
        status === 'ok' && 'bg-ok/8 border-ok/20',
        status === 'warn' && 'bg-warn/8 border-warn/20',
        status === 'crit' && 'bg-crit/8 border-crit/20',
        status === 'muted' && 'bg-raised border-border')}>
      <p className={clsx('text-[10px] font-mono font-semibold truncate leading-tight',
        status === 'ok' && 'text-ok', status === 'warn' && 'text-warn',
        status === 'crit' && 'text-crit', status === 'muted' && 'text-text-muted')}>
        {vpg.name}
      </p>
      <p className="text-[9px] text-text-muted font-mono data-value mt-0.5">{formatRpo(vpg.actualRpoSec)}</p>
    </button>
  );
}

export default function Overview() {
  const navigate = useNavigate();

  const { data: sites = [] } = useQuery({
    queryKey: ['overview-summary'], queryFn: queryOverviewSummary, refetchInterval: REFRESH,
  });
  const { data: vpgs = [], isLoading: vpgsLoading } = useQuery({
    queryKey: ['all-vpgs'], queryFn: queryAllVpgs, refetchInterval: REFRESH,
  });
  const { data: violators = [] } = useQuery({
    queryKey: ['top-violators'], queryFn: () => queryTopRpoViolators(10), refetchInterval: REFRESH,
  });
  const { data: exporterHealth = [] } = useQuery({
    queryKey: ['exporter-health'], queryFn: queryExporterHealth, refetchInterval: REFRESH,
  });

  const totalOk = sites.reduce((s, x) => s + x.ok, 0);
  const totalWarn = sites.reduce((s, x) => s + x.warn, 0);
  const totalCrit = sites.reduce((s, x) => s + x.crit, 0);
  const totalMbps = sites.reduce((s, x) => s + (x.throughputMb ?? 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Meeting SLA" value={totalOk} sub="VPGs within RPO target" color="ok" icon={CheckCircle2} />
        <StatCard label="Warnings" value={totalWarn} sub="Approaching RPO limit" color="warn" icon={AlertTriangle} />
        <StatCard label="Violations" value={totalCrit} sub="Exceeding RPO target" color="crit" icon={XCircle} />
        <StatCard label="Replication" value={`${totalMbps.toFixed(1)} MB/s`} sub="Total throughput" color="accent" icon={Activity} />
      </div>

      {sites.length > 0 && (
        <section>
          <p className="section-title mb-3">Sites</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {sites.map((s) => <SiteCard key={s.siteName} site={s} />)}
          </div>
        </section>
      )}

      <section>
        <p className="section-title mb-3">VPG RPO Heat Grid</p>
        {vpgsLoading ? (
          <div className="card p-8 text-center text-text-muted text-xs font-mono">Loading VPGs…</div>
        ) : (
          <div className="card p-4">
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
              {vpgs.sort((a, b) => {
                const sev = (v) => { const s = rpoStatus(v.actualRpoSec, v.configuredRpoSec); return s === 'crit' ? 0 : s === 'warn' ? 1 : 2; };
                return sev(a) - sev(b);
              }).map((vpg) => (
                <VpgTile key={vpg.id} vpg={vpg} onClick={() => navigate(`/vpgs?name=${encodeURIComponent(vpg.name)}`)} />
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <p className="section-title mb-3">Top RPO Violators</p>
          <div className="card overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left section-title">VPG</th>
                  <th className="px-3 py-2 text-left section-title">Site</th>
                  <th className="px-3 py-2 text-right section-title">Actual RPO</th>
                  <th className="px-3 py-2 text-right section-title">Target</th>
                  <th className="px-3 py-2 text-right section-title">Ratio</th>
                </tr>
              </thead>
              <tbody>
                {violators.map((v) => {
                  const ratio = v.configuredRpoSec ? v.actualRpoSec / v.configuredRpoSec : 0;
                  const status = rpoStatus(v.actualRpoSec, v.configuredRpoSec);
                  return (
                    <tr key={v.id} className="table-row-hover border-b border-border/40 last:border-0"
                      onClick={() => navigate(`/vpgs?name=${encodeURIComponent(v.name)}`)}>
                      <td className="px-3 py-2 font-mono font-semibold text-text-primary">{v.name}</td>
                      <td className="px-3 py-2 text-text-muted">{v.siteName}</td>
                      <td className={clsx('px-3 py-2 text-right font-data data-value', colorToText[status])}>{formatRpo(v.actualRpoSec)}</td>
                      <td className="px-3 py-2 text-right font-data data-value text-text-muted">{formatRpo(v.configuredRpoSec)}</td>
                      <td className="px-3 py-2 text-right"><span className={clsx('badge', `badge-${status}`)}>{ratio.toFixed(1)}x</span></td>
                    </tr>
                  );
                })}
                {violators.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-text-muted">
                    <CheckCircle2 size={20} className="text-ok mx-auto mb-1" />All VPGs within RPO targets
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <p className="section-title mb-3">Collector Health</p>
          <div className="card p-4 space-y-3">
            {exporterHealth.length === 0 && <p className="text-xs text-text-muted italic">No exporter data</p>}
            {exporterHealth.map((t) => (
              <div key={`${t.instance}-${t.thread}`} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                <div>
                  <p className="text-xs font-mono font-medium text-text-primary">{t.thread}</p>
                  <p className="text-[10px] text-text-muted">{t.instance}</p>
                </div>
                <span className={clsx('badge', t.alive ? 'badge-ok' : 'badge-crit')}>
                  <span className={clsx('status-dot', t.alive ? 'status-dot-ok' : 'status-dot-crit')} />
                  {t.alive ? 'Running' : 'Down'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
