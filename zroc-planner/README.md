# zROC Planner — vCenter Metrics Collector

A Python-based Prometheus exporter that replaces zPlanner's PowerCLI scripts.
It queries vCenter for per-VM virtual-disk I/O statistics using the pyvmomi SDK
and exposes them on a `/metrics` endpoint for Prometheus to scrape.

## Metrics exposed

| Prometheus metric | Unit | Description |
|---|---|---|
| `vcenter_vm_disk_write_iops` | IOPS | Write IOPS (sum across all disk instances) |
| `vcenter_vm_disk_write_throughput_mbps` | MB/s | Write throughput (sum across all disk instances) |
| `vcenter_vm_disk_write_latency_ms` | ms | Write latency (mean across all disk instances) |

Every metric carries these labels:

| Label | Example | Notes |
|---|---|---|
| `vm_name` | `web-prod-01` | VM display name |
| `vm_moref` | `vm-1234` | vCenter Managed Object Reference (stable ID) |
| `cluster` | `Cluster-01` | Compute cluster name |
| `host` | `esxi-01.corp` | ESXi host the VM is running on |
| `datacenter` | `DC-East` | vCenter datacenter name |

### Self-monitoring metrics

| Metric | Description |
|---|---|
| `vcenter_collector_last_collection_timestamp_seconds` | Unix timestamp of the last successful poll |
| `vcenter_collector_last_collection_duration_seconds` | How long the last poll took |
| `vcenter_collector_last_vm_count` | VMs collected in the last cycle |
| `vcenter_collector_cycles_total` | Running count of completed cycles |

## Configuration

All settings are environment variables.

| Variable | Default | Description |
|---|---|---|
| `VCENTER_HOST` | `vcenter.local` | vCenter hostname or IP |
| `VCENTER_USER` | `administrator@vsphere.local` | vCenter username (read-only is sufficient) |
| `VCENTER_PASSWORD` | _(required)_ | vCenter password |
| `VCENTER_PORT` | `443` | vCenter HTTPS port |
| `VCENTER_SSL_VERIFY` | `false` | Set `true` to enforce TLS certificate validation |
| `POLL_INTERVAL` | `300` | Seconds between collection cycles |
| `BATCH_SIZE` | `100` | VMs per QueryPerf call (VMware recommends ≤ 200) |
| `BATCH_DELAY` | `0.5` | Seconds to sleep between batches |
| `VM_INVENTORY_TTL` | `600` | Seconds between VM inventory refreshes |
| `PERF_INTERVAL_ID` | `300` | vCenter rollup interval (300 = 5-minute stats) |
| `HTTP_HOST` | `0.0.0.0` | IP the HTTP server binds to |
| `HTTP_PORT` | `9272` | Port for `/metrics` and `/health` |
| `LOG_LEVEL` | `INFO` | Python log level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |

## Running

### Docker (recommended)

```bash
docker build -t zroc-planner:latest .

docker run -d \
  --name zroc-planner \
  -p 9272:9272 \
  -e VCENTER_HOST=vcenter.corp.example \
  -e VCENTER_USER=svc-readonly@vsphere.local \
  -e VCENTER_PASSWORD=supersecret \
  -e POLL_INTERVAL=300 \
  -e BATCH_SIZE=100 \
  zroc-planner:latest
```

### Docker Compose

Add to your existing `docker-compose.yaml`:

```yaml
  zroc-planner:
    build: ./zroc-planner
    container_name: zroc-planner
    hostname: zroc-planner
    ports:
      - "9272:9272"
    environment:
      - VCENTER_HOST=vcenter.corp.example
      - VCENTER_USER=svc-readonly@vsphere.local
      - VCENTER_PASSWORD=supersecret
      - POLL_INTERVAL=300
      - BATCH_SIZE=100
      - BATCH_DELAY=0.5
      - VM_INVENTORY_TTL=600
      - LOG_LEVEL=INFO
    networks:
      - back-tier
    restart: always
```

Then add a scrape job to `prometheus/prometheus.yml`:

```yaml
scrape_configs:
  - job_name: vcenter_planner
    scrape_interval: 300s
    scrape_timeout: 30s
    static_configs:
      - targets: ['zroc-planner:9272']
```

### Local (dev)

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

export VCENTER_HOST=vcenter.local
export VCENTER_USER=administrator@vsphere.local
export VCENTER_PASSWORD=password

python server.py
```

## Endpoints

| Path | Description |
|---|---|
| `GET /metrics` | Prometheus text exposition |
| `GET /health` | JSON health check (200 = healthy, 503 = degraded) |

### Health check response

```json
{
  "status": "ok",
  "last_collection_time": 1712345678.0,
  "last_collection_duration_seconds": 4.23,
  "last_vm_count": 3412,
  "last_error": null,
  "collection_cycles": 42,
  "stale": false
}
```

## Scaling notes

| Environment size | Recommended settings |
|---|---|
| ≤ 500 VMs | `BATCH_SIZE=100`, `BATCH_DELAY=0.5` |
| 500–5 000 VMs | `BATCH_SIZE=150`, `BATCH_DELAY=0.5` |
| 5 000–15 000 VMs | `BATCH_SIZE=200`, `BATCH_DELAY=1.0` |

Collection of 15 000 VMs at `BATCH_SIZE=200` with `BATCH_DELAY=1.0` takes
roughly 75 batches × ~1 s each = **~75 seconds**, comfortably within the
300-second poll window.

## vCenter permissions

The service account only needs the read-only role on the vCenter root:

- `System.View`
- `Performance.ModifyIntervals` (read-only — needed to query counter definitions)

A standard **Read-Only** vCenter role is sufficient.

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│  server.py (main thread)                                   │
│    HTTPServer  /metrics  /health                           │
└────────────────────────┬───────────────────────────────────┘
                         │  reads from
┌────────────────────────▼───────────────────────────────────┐
│  collector.MetricStore  (thread-safe dict)                 │
└────────────────────────▲───────────────────────────────────┘
                         │  writes to
┌────────────────────────┴───────────────────────────────────┐
│  collector.VCenterCollector  (daemon thread)               │
│    ┌──────────────────────────────────────────────────┐   │
│    │  every POLL_INTERVAL seconds:                    │   │
│    │    1. ensure vCenter session alive               │   │
│    │    2. refresh VM inventory (if TTL expired)      │   │
│    │    3. for each batch of BATCH_SIZE VMs:          │   │
│    │         QueryPerf → parse → MetricStore.update   │   │
│    │         sleep(BATCH_DELAY)                       │   │
│    └──────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```
