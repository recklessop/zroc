"""
vCenter metrics collector for zROC Planner.

Collects virtual-disk I/O statistics from vCenter using pyvmomi's
QueryPerf API and publishes them as Prometheus gauges.

Design highlights
-----------------
* VM inventory is cached and refreshed every VM_INVENTORY_TTL seconds,
  so normal polling never touches the inventory API.
* Performance counter IDs are looked up once and cached for the life of
  the session.
* VMs are queried in batches (BATCH_SIZE) with a short sleep between
  batches so vCenter is never flooded.
* On any vCenter API error the session is torn down and re-established
  before the next poll cycle.
"""

import logging
import threading
import time
from datetime import datetime, timezone
from typing import Optional

from pyVim.connect import SmartConnect, Disconnect
from pyVmomi import vim, vmodl
import ssl

import config

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Prometheus metric storage
# ---------------------------------------------------------------------------

class MetricStore:
    """Thread-safe store for the latest per-VM disk metrics."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # key: vm_moref  value: dict of label + metric values
        self._data: dict[str, dict] = {}
        self.last_collection_time: Optional[float] = None
        self.last_collection_duration: float = 0.0
        self.last_vm_count: int = 0
        self.last_error: Optional[str] = None
        self.collection_cycles: int = 0

    def update(self, vm_moref: str, labels: dict, metrics: dict) -> None:
        with self._lock:
            self._data[vm_moref] = {"labels": labels, "metrics": metrics}

    def clear(self) -> None:
        with self._lock:
            self._data.clear()

    def snapshot(self) -> dict:
        with self._lock:
            return dict(self._data)

    def remove_stale(self, active_morefs: set[str]) -> None:
        with self._lock:
            stale = [k for k in self._data if k not in active_morefs]
            for k in stale:
                del self._data[k]


# Module-level store shared with server.py
store = MetricStore()


# ---------------------------------------------------------------------------
# vCenter session helpers
# ---------------------------------------------------------------------------

def _build_ssl_context() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    if not config.VCENTER_SSL_VERIFY:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    return ctx


def _connect() -> vim.ServiceInstance:
    log.info("Connecting to vCenter %s:%s as %s",
             config.VCENTER_HOST, config.VCENTER_PORT, config.VCENTER_USER)
    si = SmartConnect(
        host=config.VCENTER_HOST,
        user=config.VCENTER_USER,
        pwd=config.VCENTER_PASSWORD,
        port=config.VCENTER_PORT,
        sslContext=_build_ssl_context(),
        connectionPoolTimeout=60,
    )
    log.info("Connected to vCenter (session established)")
    return si


def _disconnect(si: Optional[vim.ServiceInstance]) -> None:
    if si is not None:
        try:
            Disconnect(si)
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Inventory helpers
# ---------------------------------------------------------------------------

def _get_all_vms(si: vim.ServiceInstance) -> list[vim.VirtualMachine]:
    """Return every VM object in the inventory using a ContainerView."""
    content = si.RetrieveContent()
    container = content.viewManager.CreateContainerView(
        content.rootFolder, [vim.VirtualMachine], True
    )
    try:
        vms = list(container.view)
    finally:
        container.Destroy()
    return vms


def _get_vm_labels(vm: vim.VirtualMachine) -> dict:
    """Extract topology labels for a VM.  Tolerates missing attributes."""
    try:
        name = vm.name or ""
        moref = vm._moId or ""

        # Walk the parent chain: VM → ResourcePool/vApp → ComputeResource → host
        datacenter = ""
        cluster = ""
        host_name = ""

        runtime = vm.runtime
        if runtime and runtime.host:
            h = runtime.host
            host_name = h.name if h.name else ""
            # parent of HostSystem is ComputeResource or ClusterComputeResource
            cr = h.parent
            if cr:
                cluster = cr.name if cr.name else ""
                # parent of ComputeResource is Datacenter or folder chain
                node = cr.parent
                while node is not None:
                    if isinstance(node, vim.Datacenter):
                        datacenter = node.name
                        break
                    node = getattr(node, "parent", None)

        return {
            "vm_name":    name,
            "vm_moref":   moref,
            "cluster":    cluster,
            "host":       host_name,
            "datacenter": datacenter,
        }
    except Exception as exc:
        log.debug("Could not extract labels for VM %s: %s", vm, exc)
        return {
            "vm_name": "", "vm_moref": vm._moId or "",
            "cluster": "", "host": "", "datacenter": "",
        }


def _get_vm_provisioned_gb(vm: vim.VirtualMachine) -> float:
    """Return total provisioned virtual disk capacity in GB for a VM."""
    total_kb = 0
    try:
        for device in vm.config.hardware.device:
            if isinstance(device, vim.vm.device.VirtualDisk):
                total_kb += device.capacityInKB
    except Exception as exc:
        log.debug("Could not read disk capacity for VM %s: %s", vm._moId, exc)
    return total_kb / (1024 * 1024)  # KB -> GB


# ---------------------------------------------------------------------------
# Performance counter ID cache
# ---------------------------------------------------------------------------

def _build_counter_map(si: vim.ServiceInstance) -> dict[tuple, int]:
    """Return a mapping of (group, name, rollup) -> counter key (integer id)."""
    pm = si.RetrieveContent().perfManager
    result: dict[tuple, int] = {}
    for c in pm.perfCounter:
        key = (c.groupInfo.key, c.nameInfo.key, c.rollupType)
        result[key] = c.key
    log.debug("Loaded %d performance counter definitions", len(result))
    return result


def _resolve_counter_ids(counter_map: dict[tuple, int]) -> dict[str, int]:
    """Map our human labels to integer counter IDs. Warn on missing counters."""
    resolved: dict[str, int] = {}
    for label, triple in config.COUNTERS_WANTED.items():
        cid = counter_map.get(triple)
        if cid is None:
            log.warning("Counter not found in vCenter: %s -> %s", label, triple)
        else:
            resolved[label] = cid
    return resolved


# ---------------------------------------------------------------------------
# QueryPerf batching
# ---------------------------------------------------------------------------

def _make_perf_query_spec(
    vm: vim.VirtualMachine,
    counter_ids: list[int],
    interval_id: int,
) -> vim.PerformanceManager.QuerySpec:
    metrics = [
        vim.PerformanceManager.MetricId(counterId=cid, instance="*")
        for cid in counter_ids
    ]
    return vim.PerformanceManager.QuerySpec(
        entity=vm,
        metricId=metrics,
        intervalId=interval_id,
        maxSample=1,           # we only need the most recent sample
    )


def _query_batch(
    pm: vim.PerformanceManager,
    vms: list[vim.VirtualMachine],
    counter_ids: list[int],
    interval_id: int,
) -> list:
    """Run QueryPerf for a single batch of VMs. Returns raw EntityMetric list."""
    specs = [_make_perf_query_spec(vm, counter_ids, interval_id) for vm in vms]
    try:
        results = pm.QueryPerf(querySpec=specs)
        return results or []
    except vmodl.fault.InvalidArgument as exc:
        log.warning("QueryPerf InvalidArgument for batch of %d VMs: %s", len(vms), exc)
        return []
    except Exception as exc:
        log.error("QueryPerf error for batch: %s", exc)
        raise


def _parse_results(
    results: list,
    label_cache: dict[str, dict],
    label_to_counter_id: dict[str, int],
    provisioned_gb_cache: Optional[dict[str, float]] = None,
) -> None:
    """Parse EntityMetric results and update the global MetricStore."""
    # Build reverse map: counter_id -> label
    id_to_label = {v: k for k, v in label_to_counter_id.items()}

    for entity_metric in results:
        moref = entity_metric.entity._moId
        labels = label_cache.get(moref, {"vm_name": "", "vm_moref": moref,
                                          "cluster": "", "host": "", "datacenter": ""})

        # Aggregate across all disk instances: sum IOPS/throughput, average latency
        sums: dict[str, float] = {}
        counts: dict[str, int] = {}

        for series in entity_metric.value:
            cid = series.id.counterId
            metric_label = id_to_label.get(cid)
            if metric_label is None:
                continue
            if not series.value:
                continue

            val = series.value[-1]  # most recent sample
            if val < 0:             # vCenter uses -1 for "no data"
                continue

            sums[metric_label] = sums.get(metric_label, 0.0) + val
            counts[metric_label] = counts.get(metric_label, 0) + 1

        if not sums:
            continue

        metrics: dict[str, float] = {}
        for lbl, total in sums.items():
            if lbl == "disk_write_latency":
                # average latency across disk instances
                metrics[lbl] = total / counts[lbl]
            elif lbl == "disk_write_throughput":
                # vCenter returns KB/s; convert to MB/s
                metrics[lbl] = total / 1024.0
            else:
                metrics[lbl] = total

        if provisioned_gb_cache:
            metrics["disk_provisioned_gb"] = provisioned_gb_cache.get(moref, 0.0)

        store.update(moref, labels, metrics)


# ---------------------------------------------------------------------------
# Main collection loop
# ---------------------------------------------------------------------------

class VCenterCollector:
    def __init__(self) -> None:
        self._si: Optional[vim.ServiceInstance] = None
        self._pm: Optional[vim.PerformanceManager] = None
        self._counter_ids: dict[str, int] = {}   # label -> int counter id
        self._vm_cache: list[vim.VirtualMachine] = []
        self._label_cache: dict[str, dict] = {}  # moref -> labels dict
        self._vm_cache_ts: float = 0.0
        self._stop_event = threading.Event()

    # ── public API ────────────────────────────────────────────────────────────

    def start(self) -> None:
        t = threading.Thread(target=self._run_loop, name="collector", daemon=True)
        t.start()
        log.info("Collector thread started")

    def stop(self) -> None:
        self._stop_event.set()

    # ── internal ──────────────────────────────────────────────────────────────

    def _ensure_connected(self) -> None:
        if self._si is not None:
            # Ping the session to detect stale connections
            try:
                self._si.CurrentTime()
                return
            except Exception as exc:
                log.warning("vCenter session appears stale (%s), reconnecting…", exc)
                _disconnect(self._si)
                self._si = None
                self._pm = None
                self._counter_ids = {}
                # Force inventory refresh after reconnect
                self._vm_cache_ts = 0.0

        self._si = _connect()
        content = self._si.RetrieveContent()
        self._pm = content.perfManager
        counter_map = _build_counter_map(self._si)
        self._counter_ids = _resolve_counter_ids(counter_map)
        log.info("Counter IDs resolved: %s", self._counter_ids)

    def _refresh_vm_inventory(self) -> None:
        now = time.monotonic()
        if now - self._vm_cache_ts < config.VM_INVENTORY_TTL:
            return

        log.info("Refreshing VM inventory…")
        vms = _get_all_vms(self._si)
        self._vm_cache = [
            vm for vm in vms
            if vm.runtime and vm.runtime.powerState == vim.VirtualMachinePowerState.poweredOn
        ]
        self._label_cache = {vm._moId: _get_vm_labels(vm) for vm in self._vm_cache}
        self._provisioned_gb_cache: dict[str, float] = {
            vm._moId: _get_vm_provisioned_gb(vm) for vm in self._vm_cache
        }
        self._vm_cache_ts = now
        log.info("VM inventory: %d powered-on VMs", len(self._vm_cache))

        # Remove metrics for VMs no longer in inventory
        store.remove_stale(set(self._label_cache.keys()))

    def _collect_once(self) -> None:
        t0 = time.monotonic()
        self._ensure_connected()
        self._refresh_vm_inventory()

        if not self._vm_cache:
            log.warning("No powered-on VMs found; skipping QueryPerf")
            return

        if not self._counter_ids:
            log.error("No performance counter IDs resolved; cannot collect metrics")
            return

        counter_id_list = list(self._counter_ids.values())
        total_vms = len(self._vm_cache)
        collected = 0
        errors = 0

        log.info("Starting QueryPerf collection for %d VMs in batches of %d",
                 total_vms, config.BATCH_SIZE)

        for batch_start in range(0, total_vms, config.BATCH_SIZE):
            if self._stop_event.is_set():
                break

            batch = self._vm_cache[batch_start: batch_start + config.BATCH_SIZE]
            try:
                results = _query_batch(
                    self._pm, batch, counter_id_list, config.PERF_INTERVAL_ID
                )
                _parse_results(results, self._label_cache, self._counter_ids,
                               self._provisioned_gb_cache)
                collected += len(batch)
            except Exception as exc:
                errors += len(batch)
                log.error("Batch %d–%d failed: %s",
                          batch_start, batch_start + len(batch), exc)
                # Assume session is broken; force reconnect next cycle
                _disconnect(self._si)
                self._si = None
                self._pm = None
                self._counter_ids = {}
                self._vm_cache_ts = 0.0
                break

            if batch_start + config.BATCH_SIZE < total_vms:
                time.sleep(config.BATCH_DELAY)

        elapsed = time.monotonic() - t0
        store.last_collection_time = time.time()
        store.last_collection_duration = elapsed
        store.last_vm_count = collected
        store.last_error = None if errors == 0 else f"{errors} VMs failed"
        store.collection_cycles += 1

        log.info(
            "Collection complete: %d/%d VMs, %.1fs elapsed%s",
            collected, total_vms, elapsed,
            f", {errors} errors" if errors else "",
        )

    def _run_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                self._collect_once()
            except Exception as exc:
                store.last_error = str(exc)
                log.exception("Unhandled error in collection cycle: %s", exc)
                _disconnect(self._si)
                self._si = None
                self._pm = None
                self._counter_ids = {}
                self._vm_cache_ts = 0.0

            # Sleep until next poll, but wake up early if stopped
            self._stop_event.wait(timeout=config.POLL_INTERVAL)

        log.info("Collector thread exiting")
        _disconnect(self._si)
