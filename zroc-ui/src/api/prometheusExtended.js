// src/api/prometheusExtended.js
import { instantQuery, rangeQuery, labelValues } from './prometheus';

export async function queryVpgDetail(vpgName) {
  const esc = vpgName.replace(/"/g, '\\"');
  const [rpo, cfgRpo, alert, status, throughput, iops, vmCount,
    storageUsed, storageProv, histActual, histCfg, failsafeActual, failsafeCfg] =
    await Promise.all([
      instantQuery(`vpg_actual_rpo{VpgName="${esc}"}`),
      instantQuery(`vpg_configured_rpo{VpgName="${esc}"}`),
      instantQuery(`vpg_alert_status{VpgName="${esc}"}`),
      instantQuery(`vpg_status{VpgName="${esc}"}`),
      instantQuery(`vpg_throughput_in_mb{VpgName="${esc}"}`),
      instantQuery(`vpg_iops{VpgName="${esc}"}`),
      instantQuery(`vpg_vms_count{VpgName="${esc}"}`),
      instantQuery(`vpg_storage_used_in_mb{VpgName="${esc}"}`),
      instantQuery(`vpg_provisioned_storage_in_mb{VpgName="${esc}"}`),
      instantQuery(`vpg_actual_history{VpgName="${esc}"}`),
      instantQuery(`vpg_configured_history{VpgName="${esc}"}`),
      instantQuery(`vpg_failsafe_actual{VpgName="${esc}"}`),
      instantQuery(`vpg_failsafe_configured{VpgName="${esc}"}`),
    ]);

  const val = (vec) => parseFloat(vec?.[0]?.value?.[1] ?? 0);
  const meta = rpo?.[0]?.metric ?? {};

  return {
    name:             vpgName,
    siteName:         meta.SiteName,
    priority:         meta.VpgPriority,
    actualRpoSec:     val(rpo),
    configuredRpoSec: val(cfgRpo),
    alertStatus:      val(alert),
    status:           val(status),
    throughputMb:     val(throughput),
    iops:             val(iops),
    vmCount:          val(vmCount),
    storageUsedMb:    val(storageUsed),
    storageProvMb:    val(storageProv),
    histActualMin:    val(histActual),
    histConfiguredMin:val(histCfg),
    failsafeActualMin:val(failsafeActual),
    failsafeCfgMin:   val(failsafeCfg),
  };
}

export async function queryVpgVms(vpgName) {
  const esc = vpgName.replace(/"/g, '\\"');
  const [rpo, status, throughput, iops, journalUsed, journalHard] = await Promise.all([
    instantQuery(`vm_actualrpo{VpgName="${esc}"}`),
    instantQuery(`vm_status{VpgName="${esc}"}`),
    instantQuery(`vm_throughput_in_mb{VpgName="${esc}"}`),
    instantQuery(`vm_iops{VpgName="${esc}"}`),
    instantQuery(`vm_journal_used_storage_mb{VpgName="${esc}"}`),
    instantQuery(`vm_journal_hard_limit{VpgName="${esc}"}`),
  ]);

  const byId = {};
  const idx = (vec, field, transform = Number) => {
    for (const { metric, value } of vec) {
      const id = metric.VmIdentifier || metric.VmName;
      if (!byId[id]) byId[id] = {
        id,
        name:        metric.VmName,
        sourceVra:   metric.VmSourceVRA,
        recoveryVra: metric.VmRecoveryVRA,
        priority:    metric.VmPriority,
      };
      byId[id][field] = transform(value[1]);
    }
  };

  idx(rpo,         'actualRpoSec');
  idx(status,      'status');
  idx(throughput,  'throughputMb', parseFloat);
  idx(iops,        'iops',         parseFloat);
  idx(journalUsed, 'journalUsedMb', parseFloat);
  idx(journalHard, 'journalHardLimit', parseFloat);

  return Object.values(byId);
}

export async function queryAllVms() {
  const [rpo, status, throughput, iops, journalUsed, bandwidth, pctEnc] = await Promise.all([
    instantQuery('vm_actualrpo'),
    instantQuery('vm_status'),
    instantQuery('vm_throughput_in_mb'),
    instantQuery('vm_iops'),
    instantQuery('vm_journal_used_storage_mb'),
    instantQuery('vm_outgoing_bandwidth_in_mbps'),
    instantQuery('vm_PercentEncrypted'),
  ]);

  const byId = {};
  const idx = (vec, field, transform = Number) => {
    for (const { metric, value } of vec) {
      const id = metric.VmIdentifier || metric.VmName;
      if (!byId[id]) byId[id] = {
        id,
        name:        metric.VmName,
        vpgName:     metric.VpgName,
        siteName:    metric.SiteName,
        sourceVra:   metric.VmSourceVRA,
        recoveryVra: metric.VmRecoveryVRA,
      };
      byId[id][field] = transform(value[1]);
    }
  };

  idx(rpo,         'actualRpoSec');
  idx(status,      'status');
  idx(throughput,  'throughputMb', parseFloat);
  idx(iops,        'iops',         parseFloat);
  idx(journalUsed, 'journalUsedMb', parseFloat);
  idx(bandwidth,   'bandwidthMbps', parseFloat);
  idx(pctEnc,      'pctEncrypted', parseFloat);

  return Object.values(byId);
}

export async function queryAllVras() {
  const [mem, cpu, memUsage, cpuUsage,
    protVms, recVms, protVpgs, recVpgs, protVols, recVols, selfVpgs] =
    await Promise.all([
      instantQuery('vra_memory_in_GB'),
      instantQuery('vra_vcpu_count'),
      instantQuery('vra_memory_usage_mb'),
      instantQuery('vra_cpu_usage_mhz'),
      instantQuery('vra_protected_vms'),
      instantQuery('vra_recovery_vms'),
      instantQuery('vra_protected_vpgs'),
      instantQuery('vra_recovery_vpgs'),
      instantQuery('vra_protected_volumes'),
      instantQuery('vra_recovery_volumes'),
      instantQuery('vra_self_protected_vpgs'),
    ]);

  const byName = {};
  const idx = (vec, field, transform = Number) => {
    for (const { metric, value } of vec) {
      const key = metric.VraName || metric.VraIdentifierStr;
      if (!byName[key]) byName[key] = {
        id:          metric.VraIdentifierStr,
        name:        metric.VraName,
        version:     metric.VraVersion,
        hostVersion: metric.HostVersion,
        siteName:    metric.SiteName,
        siteId:      metric.SiteIdentifier,
      };
      byName[key][field] = transform(value[1]);
    }
  };

  idx(mem,      'memoryGb',         parseFloat);
  idx(cpu,      'vcpuCount');
  idx(memUsage, 'memUsageMb',       parseFloat);
  idx(cpuUsage, 'cpuUsageMhz',      parseFloat);
  idx(protVms,  'protectedVms');
  idx(recVms,   'recoveryVms');
  idx(protVpgs, 'protectedVpgs');
  idx(recVpgs,  'recoveryVpgs');
  idx(protVols, 'protectedVolumes');
  idx(recVols,  'recoveryVolumes');
  idx(selfVpgs, 'selfProtectedVpgs');

  return Object.values(byName);
}

export async function queryEncryptionDetail() {
  const [pctEnc, trend, encrypted, unencrypted, total, ioOps, writeCounter] =
    await Promise.all([
      instantQuery('vm_PercentEncrypted'),
      instantQuery('vm_TrendChangeLevel'),
      instantQuery('vm_EncryptedDataInLBs'),
      instantQuery('vm_UnencryptedDataInLBs'),
      instantQuery('vm_TotalDataInLBs'),
      instantQuery('vm_IoOperationsCounter'),
      instantQuery('vm_WriteCounterInMBs'),
    ]);

  const byId = {};
  const idx = (vec, field, transform = Number) => {
    for (const { metric, value } of vec) {
      const id = metric.VmIdentifier || metric.VmName;
      if (!byId[id]) byId[id] = {
        id,
        name:    metric.VmName,
        vpgName: metric.VpgName,
        siteName:metric.SiteName,
        vpgId:   metric.VpgIdentifier,
      };
      byId[id][field] = transform(value[1]);
    }
  };

  idx(pctEnc,      'pctEncrypted',   parseFloat);
  idx(trend,       'trendLevel',     parseFloat);
  idx(encrypted,   'encryptedLbs',   parseFloat);
  idx(unencrypted, 'unencryptedLbs', parseFloat);
  idx(total,       'totalLbs',       parseFloat);
  idx(ioOps,       'ioOps',          parseFloat);
  idx(writeCounter,'writeMb',        parseFloat);

  return Object.values(byId).sort((a, b) => (b.pctEncrypted ?? 0) - (a.pctEncrypted ?? 0));
}

export async function queryDatastores() {
  const metrics = [
    'datastore_capacity_in_bytes',
    'datastore_free_in_bytes',
    'datastore_used_in_bytes',
    'datastore_vras',
    'datastore_incoming_vms',
    'datastore_outgoing_vms',
    'datastore_usage_zerto_journal_used_in_bytes',
    'datastore_usage_zerto_scratch_used_in_bytes',
    'datastore_usage_zerto_recovery_used_in_bytes',
    'datastore_usage_zerto_appliances_used_in_bytes',
  ];

  const results = await Promise.all(metrics.map(instantQuery));

  const byId = {};
  metrics.forEach((metric, mi) => {
    const fieldMap = {
      datastore_capacity_in_bytes:                      'capacityBytes',
      datastore_free_in_bytes:                          'freeBytes',
      datastore_used_in_bytes:                          'usedBytes',
      datastore_vras:                                   'vraCount',
      datastore_incoming_vms:                           'incomingVms',
      datastore_outgoing_vms:                           'outgoingVms',
      datastore_usage_zerto_journal_used_in_bytes:      'journalBytes',
      datastore_usage_zerto_scratch_used_in_bytes:      'scratchBytes',
      datastore_usage_zerto_recovery_used_in_bytes:     'recoveryBytes',
      datastore_usage_zerto_appliances_used_in_bytes:   'applianceBytes',
    };
    const field = fieldMap[metric];
    for (const { metric: m, value } of results[mi]) {
      const id = m.datastoreIdentifier || m.DatastoreName;
      if (!byId[id]) byId[id] = {
        id, name: m.DatastoreName, siteName: m.SiteName,
      };
      byId[id][field] = parseFloat(value[1]);
    }
  });

  return Object.values(byId).sort((a, b) => (b.capacityBytes ?? 0) - (a.capacityBytes ?? 0));
}
