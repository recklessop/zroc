"""
Configuration for the zROC Planner vCenter metrics collector.
All settings are driven by environment variables with sensible defaults.
"""

import os
import logging


def _get_int(key: str, default: int) -> int:
    try:
        return int(os.environ.get(key, default))
    except (ValueError, TypeError):
        return default


def _get_float(key: str, default: float) -> float:
    try:
        return float(os.environ.get(key, default))
    except (ValueError, TypeError):
        return default


def _get_bool(key: str, default: bool) -> bool:
    val = os.environ.get(key, "").strip().lower()
    if val in ("1", "true", "yes"):
        return True
    if val in ("0", "false", "no"):
        return False
    return default


# ── vCenter connection ────────────────────────────────────────────────────────
VCENTER_HOST: str = os.environ.get("VCENTER_HOST", "vcenter.local")
VCENTER_USER: str = os.environ.get("VCENTER_USER", "administrator@vsphere.local")
VCENTER_PASSWORD: str = os.environ.get("VCENTER_PASSWORD", "")
VCENTER_PORT: int = _get_int("VCENTER_PORT", 443)
VCENTER_SSL_VERIFY: bool = _get_bool("VCENTER_SSL_VERIFY", False)

# ── collection tuning ─────────────────────────────────────────────────────────
# How often (seconds) the collector runs a full poll cycle
POLL_INTERVAL: int = _get_int("POLL_INTERVAL", 300)

# Size of each QueryPerf batch (VMware recommends ≤200)
BATCH_SIZE: int = _get_int("BATCH_SIZE", 100)

# Seconds to sleep between batches to avoid hammering vCenter
BATCH_DELAY: float = _get_float("BATCH_DELAY", 0.5)

# How often (seconds) to refresh the VM inventory list
VM_INVENTORY_TTL: int = _get_int("VM_INVENTORY_TTL", 600)

# Rollup interval for performance counters (300 = 5-minute stats)
PERF_INTERVAL_ID: int = _get_int("PERF_INTERVAL_ID", 300)

# ── HTTP server ───────────────────────────────────────────────────────────────
HTTP_HOST: str = os.environ.get("HTTP_HOST", "0.0.0.0")
HTTP_PORT: int = _get_int("HTTP_PORT", 9272)

# ── logging ───────────────────────────────────────────────────────────────────
LOG_LEVEL: str = os.environ.get("LOG_LEVEL", "INFO").upper()

# ── counter names we care about ───────────────────────────────────────────────
# These are the vSphere performance counter names for disk metrics.
# Mapped as: human_label -> (group, name, rollup_type)
COUNTERS_WANTED: dict[str, tuple[str, str, str]] = {
    "disk_write_iops":       ("virtualDisk", "numberWriteAveraged", "average"),
    "disk_write_throughput": ("virtualDisk", "write",               "average"),
    "disk_write_latency":    ("virtualDisk", "totalWriteLatency",   "average"),
}


def configure_logging() -> None:
    level = getattr(logging, LOG_LEVEL, logging.INFO)
    logging.basicConfig(
        format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
        level=level,
    )
