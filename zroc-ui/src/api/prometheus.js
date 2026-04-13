// src/api/prometheus.js
const BASE = '/api/prometheus/api/v1';

async function promFetch(endpoint, params = {}) {
  const url = new URL(BASE + endpoint, window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString(), { credentials: 'include' });
  if (!res.ok) throw new Error(`Prometheus error: ${res.status}`);
  const json = await res.json();
  if (json.status !== 'success') throw new Error(json.error || 'Prometheus query failed');
  return json.data;
}

export async function instantQuery(promql, time) {
  const params = { query: promql };
  if (time) params.time = time;
  const data = await promFetch('/query', params);
  return data.result;
}

export async function rangeQuery(promql, start, end, step = '60s') {
  const data = await promFetch('/query_range', { query: promql, start, end, step });
  return data.result;
}

export async function labelValues(labelName, match) {
  const params = {};
  if (match) params.match = match;
  const data = await promFetch(`/label/${labelName}/values`, params);
  return data;
}

export async function querySites() {
  return labelValues('SiteName', 'vpg_actual_rpo');
}

export async function queryOverviewSummary() {
  const [alertVec, throughputVec, rpoVec] = await Promise.all([
    instantQuery('vpg_alert_status'),
    instantQuery('sum by (SiteName) (vpg_throughput_in_mb)'),
    instantQuery('max by (SiteName) (vpg_actual_rpo)'),
  ]);

  const siteMap = {};
  for (const { metric, value } of alertVec) {
    const site = metric.SiteName || 'Unknown';
    if (!siteMap[site]) siteMap[site] = { siteName: site, ok: 0, warn: 0, crit: 0 };
    const v = Number(value[1]);
    if (v === 0) siteMap[site].ok++;
    else if (v === 1) siteMap[site].warn++;
    else siteMap[site].crit++;
  }

  for (const { metric, value } of throughputVec) {
    const site = metric.SiteName || 'Unknown';
    if (siteMap[site]) siteMap[site].throughputMb = parseFloat(value[1]);
  }

  for (const { metric, value } of rpoVec) {
    const site = metric.SiteName || 'Unknown';
    if (siteMap[site]) siteMap[site].worstRpoSec = parseFloat(value[1]);
  }

  return Object.values(siteMap).map((s) => ({
    ...s,
    total: s.ok + s.warn + s.crit,
  }));
}

export async function queryAllVpgs() {
  const [rpoVec, configuredVec, alertVec, throughputVec, iopsVec, vmCountVec] =
    await Promise.all([
      instantQuery('vpg_actual_rpo'),
      instantQuery('vpg_configured_rpo'),
      instantQuery('vpg_alert_status'),
      instantQuery('vpg_throughput_in_mb'),
      instantQuery('vpg_iops'),
      instantQuery('vpg_vms_count'),
    ]);

  const byId = {};
  const idx = (vec, field, transform = Number) => {
    for (const { metric, value } of vec) {
      const id = metric.VpgIdentifier || metric.VpgName;
      if (!byId[id]) byId[id] = {
        id,
        name:       metric.VpgName     || id,
        siteName:   metric.SiteName    || 'Unknown',
        siteId:     metric.SiteIdentifier,
        priority:   metric.VpgPriority,
      };
      byId[id][field] = transform(value[1]);
    }
  };

  idx(rpoVec,        'actualRpoSec');
  idx(configuredVec, 'configuredRpoSec');
  idx(alertVec,      'alertStatus');
  idx(throughputVec, 'throughputMb', parseFloat);
  idx(iopsVec,       'iops',         parseFloat);
  idx(vmCountVec,    'vmCount');

  return Object.values(byId);
}

export async function queryTopRpoViolators(n = 10) {
  const vpgs = await queryAllVpgs();
  return vpgs
    .filter((v) => v.actualRpoSec && v.configuredRpoSec)
    .sort((a, b) => (b.actualRpoSec / b.configuredRpoSec) - (a.actualRpoSec / a.configuredRpoSec))
    .slice(0, n);
}

export async function queryVpgRpoHistory(vpgName, startOffset = '6h', step = '60s') {
  const end   = Math.floor(Date.now() / 1000);
  const start = end - parseDuration(startOffset);
  const q = `vpg_actual_rpo{VpgName="${vpgName}"}`;
  const result = await rangeQuery(q, start, end, step);
  if (!result.length) return [];
  const configured = (await instantQuery(`vpg_configured_rpo{VpgName="${vpgName}"}`))
    ?.[0]?.value?.[1];
  return result[0].values.map(([ts, v]) => ({
    ts: ts * 1000,
    rpo: parseFloat(v),
    configured: configured ? parseFloat(configured) : undefined,
  }));
}

export async function queryVraHealth() {
  const [memVec, cpuVec, protVmsVec, recVmsVec, protVolVec, recVolVec] = await Promise.all([
    instantQuery('vra_memory_usage_mb'),
    instantQuery('vra_cpu_usage_mhz'),
    instantQuery('vra_protected_vms'),
    instantQuery('vra_recovery_vms'),
    instantQuery('vra_protected_volumes'),
    instantQuery('vra_recovery_volumes'),
  ]);

  const byName = {};
  const idx = (vec, field, transform = Number) => {
    for (const { metric, value } of vec) {
      const key = metric.VraName || metric.VraIdentifierStr;
      if (!byName[key]) byName[key] = {
        name:        metric.VraName,
        version:     metric.VraVersion,
        hostVersion: metric.HostVersion,
        siteName:    metric.SiteName,
      };
      byName[key][field] = transform(value[1]);
    }
  };

  idx(memVec,     'memoryUsageMb', parseFloat);
  idx(cpuVec,     'cpuUsageMhz',   parseFloat);
  idx(protVmsVec, 'protectedVms');
  idx(recVmsVec,  'recoveryVms');
  idx(protVolVec, 'protectedVolumes');
  idx(recVolVec,  'recoveryVolumes');

  return Object.values(byName);
}

export async function queryEncryptionOverview() {
  const vec = await instantQuery('vm_PercentEncrypted > 50');
  return vec.map(({ metric, value }) => ({
    vmName:    metric.VmName,
    vpgName:   metric.VpgName,
    siteName:  metric.SiteName,
    pctEnc:    parseFloat(value[1]),
    trend:     metric.vm_TrendChangeLevel,
  })).sort((a, b) => b.pctEnc - a.pctEnc);
}

export async function queryExporterHealth() {
  const vec = await instantQuery('exporter_thread_status');
  return vec.map(({ metric, value }) => ({
    instance: metric.ExporterInstance,
    thread:   metric.thread,
    alive:    Number(value[1]) === 1,
  }));
}

function parseDuration(s) {
  const match = s.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 3600;
  const [, n, unit] = match;
  const mul = { s: 1, m: 60, h: 3600, d: 86400 };
  return parseInt(n, 10) * mul[unit];
}
