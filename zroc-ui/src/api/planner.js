// src/api/planner.js
// Queries the vcenter_vm_disk_* metrics exposed by zroc-planner collector.
import { instantQuery } from './prometheus';

export async function queryPlannerVms() {
  const [throughput, iops, latency, provisioned] = await Promise.all([
    instantQuery('vcenter_vm_disk_write_throughput_mbps'),
    instantQuery('vcenter_vm_disk_write_iops'),
    instantQuery('vcenter_vm_disk_write_latency_ms'),
    instantQuery('vcenter_vm_disk_provisioned_gb'),
  ]);

  const byMoref = {};

  const idx = (vec, field, transform = parseFloat) => {
    for (const { metric, value } of vec) {
      const id = metric.vm_moref || metric.vm_name;
      if (!byMoref[id]) byMoref[id] = {
        moref:      metric.vm_moref || id,
        name:       metric.vm_name  || id,
        cluster:    metric.cluster  || '',
        host:       metric.host     || '',
        datacenter: metric.datacenter || '',
      };
      byMoref[id][field] = transform(value[1]);
    }
  };

  idx(throughput,  'writeThroughputMbps');
  idx(iops,        'writeIops');
  idx(latency,     'writeLatencyMs');
  idx(provisioned, 'provisionedGb');

  return Object.values(byMoref).sort((a, b) =>
    (b.writeThroughputMbps ?? 0) - (a.writeThroughputMbps ?? 0)
  );
}
