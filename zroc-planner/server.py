"""
HTTP server for the zROC Planner vCenter metrics collector.

Exposes:
  GET /metrics  — Prometheus text exposition format
  GET /health   — JSON health-check (used by Docker HEALTHCHECK and load balancers)
"""

import json
import logging
import signal
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Optional

import config
import collector as col

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Prometheus text format renderer
# ---------------------------------------------------------------------------

_METRIC_HELP = {
    "vcenter_vm_disk_write_iops": (
        "gauge",
        "Virtual disk write IOPS (numberWriteAveraged.average, sum across all disk instances)",
    ),
    "vcenter_vm_disk_write_throughput_mbps": (
        "gauge",
        "Virtual disk write throughput in MB/s (write.average, sum across all disk instances)",
    ),
    "vcenter_vm_disk_write_latency_ms": (
        "gauge",
        "Virtual disk write latency in milliseconds (totalWriteLatency.average, mean across disk instances)",
    ),
}

# Maps our collector metric keys to Prometheus metric names
_METRIC_NAME_MAP = {
    "disk_write_iops":       "vcenter_vm_disk_write_iops",
    "disk_write_throughput": "vcenter_vm_disk_write_throughput_mbps",
    "disk_write_latency":    "vcenter_vm_disk_write_latency_ms",
}


def _escape_label_value(v: str) -> str:
    return v.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def _render_labels(labels: dict) -> str:
    parts = [
        f'{k}="{_escape_label_value(str(v))}"'
        for k, v in labels.items()
    ]
    return "{" + ",".join(parts) + "}"


def _build_prometheus_output() -> str:
    lines: list[str] = []
    snapshot = col.store.snapshot()

    # Emit # HELP / # TYPE headers once per metric name
    emitted_headers: set[str] = set()

    for _moref, entry in snapshot.items():
        labels = entry["labels"]
        metrics = entry["metrics"]
        label_str = _render_labels(labels)

        for col_key, value in metrics.items():
            prom_name = _METRIC_NAME_MAP.get(col_key)
            if prom_name is None:
                continue

            if prom_name not in emitted_headers:
                mtype, mhelp = _METRIC_HELP[prom_name]
                lines.append(f"# HELP {prom_name} {mhelp}")
                lines.append(f"# TYPE {prom_name} {mtype}")
                emitted_headers.add(prom_name)

            lines.append(f"{prom_name}{label_str} {value:.4f}")

    # Collector self-metrics
    lines += [
        "# HELP vcenter_collector_last_collection_timestamp_seconds Unix timestamp of the last completed collection cycle",
        "# TYPE vcenter_collector_last_collection_timestamp_seconds gauge",
    ]
    ts = col.store.last_collection_time
    lines.append(f"vcenter_collector_last_collection_timestamp_seconds {ts or 0:.0f}")

    lines += [
        "# HELP vcenter_collector_last_collection_duration_seconds Duration of the last collection cycle in seconds",
        "# TYPE vcenter_collector_last_collection_duration_seconds gauge",
    ]
    lines.append(f"vcenter_collector_last_collection_duration_seconds {col.store.last_collection_duration:.3f}")

    lines += [
        "# HELP vcenter_collector_last_vm_count Number of VMs collected in the last cycle",
        "# TYPE vcenter_collector_last_vm_count gauge",
    ]
    lines.append(f"vcenter_collector_last_vm_count {col.store.last_vm_count}")

    lines += [
        "# HELP vcenter_collector_cycles_total Total number of completed collection cycles",
        "# TYPE vcenter_collector_cycles_total counter",
    ]
    lines.append(f"vcenter_collector_cycles_total {col.store.collection_cycles}")

    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# HTTP handler
# ---------------------------------------------------------------------------

class _Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        # Route HTTP access log through the standard logger at DEBUG level
        log.debug("HTTP %s", fmt % args)

    def do_GET(self) -> None:
        path = self.path.split("?")[0]

        if path == "/metrics":
            self._serve_metrics()
        elif path in ("/health", "/healthz", "/ready"):
            self._serve_health()
        else:
            self._send(404, "text/plain", b"Not Found\n")

    def _serve_metrics(self) -> None:
        body = _build_prometheus_output().encode("utf-8")
        self._send(200, "text/plain; version=0.0.4; charset=utf-8", body)

    def _serve_health(self) -> None:
        now = time.time()
        last_ts = col.store.last_collection_time
        last_error = col.store.last_error

        # Unhealthy if we've never collected, or the last collection was more
        # than 3× the poll interval ago (suggests the loop is hung/dead).
        stale_threshold = config.POLL_INTERVAL * 3
        is_stale = last_ts is None or (now - last_ts) > stale_threshold
        healthy = not is_stale and last_error is None

        payload = {
            "status": "ok" if healthy else "degraded",
            "last_collection_time": last_ts,
            "last_collection_duration_seconds": col.store.last_collection_duration,
            "last_vm_count": col.store.last_vm_count,
            "last_error": last_error,
            "collection_cycles": col.store.collection_cycles,
            "stale": is_stale,
        }
        body = json.dumps(payload, indent=2).encode("utf-8")
        status = 200 if healthy else 503
        self._send(status, "application/json", body)

    def _send(self, code: int, content_type: str, body: bytes) -> None:
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    config.configure_logging()
    log.info("zROC Planner vCenter Collector starting")
    log.info(
        "Config: vCenter=%s port=%s poll_interval=%ss batch_size=%d",
        config.VCENTER_HOST, config.VCENTER_PORT,
        config.POLL_INTERVAL, config.BATCH_SIZE,
    )

    # Start the background collection loop
    c = col.VCenterCollector()
    c.start()

    # Graceful shutdown on SIGTERM / SIGINT
    def _shutdown(signum, frame) -> None:
        log.info("Caught signal %d, shutting down…", signum)
        c.stop()
        sys.exit(0)

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT, _shutdown)

    # Start HTTP server (blocking)
    httpd = HTTPServer((config.HTTP_HOST, config.HTTP_PORT), _Handler)
    log.info("HTTP server listening on %s:%d", config.HTTP_HOST, config.HTTP_PORT)
    log.info("Metrics endpoint: http://%s:%d/metrics", config.HTTP_HOST, config.HTTP_PORT)
    log.info("Health endpoint:  http://%s:%d/health",  config.HTTP_HOST, config.HTTP_PORT)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        c.stop()
        httpd.server_close()
        log.info("Server stopped")


if __name__ == "__main__":
    main()
