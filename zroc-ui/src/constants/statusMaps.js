// src/constants/statusMaps.js
export const VPG_STATUS = {
  0: { label: 'Initializing',           color: 'info',  dot: 'info' },
  1: { label: 'Meeting SLA',            color: 'ok',    dot: 'ok'   },
  2: { label: 'Not Meeting SLA',        color: 'crit',  dot: 'crit' },
  3: { label: 'History Not Meeting SLA',color: 'warn',  dot: 'warn' },
  4: { label: 'RPO Not Meeting SLA',    color: 'crit',  dot: 'crit' },
  5: { label: 'Failing Over',           color: 'info',  dot: 'info' },
  6: { label: 'Moving',                 color: 'info',  dot: 'info' },
  7: { label: 'Deleting',              color: 'muted', dot: 'idle' },
  8: { label: 'Recovering',            color: 'info',  dot: 'info' },
  9: { label: 'Needs Configuration',   color: 'warn',  dot: 'warn' },
};

export const VPG_ALERT = {
  0: { label: 'No Alert', color: 'ok'   },
  1: { label: 'Warning',  color: 'warn' },
  2: { label: 'Error',    color: 'crit' },
};

export const VM_STATUS = {
  0: { label: 'Protected',              color: 'ok'   },
  1: { label: 'Initializing',           color: 'info' },
  2: { label: 'Replication Paused',     color: 'warn' },
  3: { label: 'Error',                  color: 'crit' },
  4: { label: 'Empty Protection Group', color: 'muted'},
  5: { label: 'Disconnected',           color: 'crit' },
  6: { label: 'Backing Up',             color: 'info' },
  7: { label: 'Preparing Failover',     color: 'info' },
  8: { label: 'Failing Over',           color: 'info' },
  9: { label: 'Move Failed',            color: 'crit' },
};

export function vpgHealth(statusCode) {
  const s = VPG_STATUS[statusCode] ?? { label: 'Unknown', color: 'muted', dot: 'idle' };
  return s;
}

export function isVpgAlerting(statusCode) {
  return [2, 4].includes(statusCode);
}

export function isVpgWarning(statusCode) {
  return [3, 9].includes(statusCode);
}

export const colorToText = {
  ok:    'text-ok',
  warn:  'text-warn',
  crit:  'text-crit',
  info:  'text-info',
  muted: 'text-text-muted',
};

export const colorToBg = {
  ok:    'bg-ok/10',
  warn:  'bg-warn/10',
  crit:  'bg-crit/10',
  info:  'bg-info/10',
  muted: 'bg-raised',
};

export function formatRpo(seconds) {
  if (seconds == null || isNaN(seconds)) return '—';
  const s = Math.round(seconds);
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2,'0')}s`;
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2,'0')}m`;
}

export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

export function formatMB(mb) {
  return formatBytes((mb ?? 0) * 1024 * 1024);
}

export function rpoStatus(actualSec, configuredSec) {
  if (!actualSec || !configuredSec) return 'muted';
  const ratio = actualSec / configuredSec;
  if (ratio <= 0.75) return 'ok';
  if (ratio <= 1.0)  return 'warn';
  return 'crit';
}
