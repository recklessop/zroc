// src/pages/Planner.jsx — DR capacity planner
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calculator, HardDrive, Wifi, Database, Download, Search, FileText } from 'lucide-react';
import { queryPlannerVms } from '@/api/planner';
import clsx from 'clsx';
import { jsPDF } from 'jspdf';

const REFRESH = 60_000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtGb(gb) {
  if (gb == null || isNaN(gb)) return '—';
  if (gb >= 1024) return `${(gb / 1024).toFixed(2)} TB`;
  return `${gb.toFixed(1)} GB`;
}

function fmtMbps(mbps) {
  if (mbps == null || isNaN(mbps)) return '—';
  if (mbps >= 1000) return `${(mbps / 1000).toFixed(2)} Gbps`;
  return `${mbps.toFixed(1)} Mbps`;
}

const JOURNAL_OPTIONS = [
  { label: '1 hour',  seconds: 3600 },
  { label: '4 hours', seconds: 14400 },
  { label: '8 hours', seconds: 28800 },
  ...Array.from({ length: 30 }, (_, i) => ({
    label:   i === 0 ? '1 day' : `${i + 1} days`,
    seconds: (i + 1) * 86400,
  })),
];

// ── Result card ───────────────────────────────────────────────────────────────

function ResultCard({ icon: Icon, label, value, sub, color = 'accent' }) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', `bg-${color}/10`)}>
        <Icon size={18} className={`text-${color}`} />
      </div>
      <div>
        <p className="section-title">{label}</p>
        <p className="font-data text-2xl font-semibold text-text-primary mt-0.5 data-value">{value}</p>
        {sub && <p className="text-xs text-text-muted mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ── VM row ────────────────────────────────────────────────────────────────────

function VmRow({ vm, selected, onToggle }) {
  return (
    <tr
      onClick={onToggle}
      className={clsx(
        'cursor-pointer transition-colors duration-100',
        selected ? 'bg-accent/8' : 'hover:bg-raised',
      )}
    >
      <td className="px-3 py-2.5 w-8">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          className="accent-accent"
        />
      </td>
      <td className="px-3 py-2.5 font-mono text-xs text-text-primary">{vm.name}</td>
      <td className="px-3 py-2.5 font-mono text-xs text-text-secondary">{vm.cluster || '—'}</td>
      <td className="px-3 py-2.5 font-mono text-xs text-text-secondary">{vm.datacenter || '—'}</td>
      <td className="px-3 py-2.5 font-mono text-xs text-right data-value">{fmtGb(vm.provisionedGb)}</td>
      <td className="px-3 py-2.5 font-mono text-xs text-right data-value">{fmtMbps(vm.writeThroughputMbps)}</td>
      <td className="px-3 py-2.5 font-mono text-xs text-right text-text-muted data-value">
        {vm.writeIops != null ? vm.writeIops.toFixed(0) : '—'}
      </td>
    </tr>
  );
}

// ── Mock data for preview ─────────────────────────────────────────────────────

const MOCK_VMS = [
  { moref: 'vm-101', name: 'web-prod-01',  cluster: 'Cluster-01', datacenter: 'DC-East', provisionedGb: 120,  writeThroughputMbps: 45.2, writeIops: 1820, writeLatencyMs: 3.1 },
  { moref: 'vm-102', name: 'db-prod-01',   cluster: 'Cluster-01', datacenter: 'DC-East', provisionedGb: 2048, writeThroughputMbps: 312.8, writeIops: 12400, writeLatencyMs: 1.8 },
  { moref: 'vm-103', name: 'db-prod-02',   cluster: 'Cluster-01', datacenter: 'DC-East', provisionedGb: 2048, writeThroughputMbps: 287.4, writeIops: 11200, writeLatencyMs: 2.0 },
  { moref: 'vm-104', name: 'app-prod-01',  cluster: 'Cluster-02', datacenter: 'DC-East', provisionedGb: 256,  writeThroughputMbps: 18.6, writeIops: 640,  writeLatencyMs: 4.2 },
  { moref: 'vm-105', name: 'app-prod-02',  cluster: 'Cluster-02', datacenter: 'DC-East', provisionedGb: 256,  writeThroughputMbps: 21.3, writeIops: 780,  writeLatencyMs: 3.9 },
  { moref: 'vm-106', name: 'cache-01',     cluster: 'Cluster-02', datacenter: 'DC-East', provisionedGb: 512,  writeThroughputMbps: 8.1,  writeIops: 310,  writeLatencyMs: 5.5 },
  { moref: 'vm-107', name: 'file-srv-01',  cluster: 'Cluster-03', datacenter: 'DC-West', provisionedGb: 4096, writeThroughputMbps: 92.0, writeIops: 3200, writeLatencyMs: 6.1 },
  { moref: 'vm-108', name: 'infra-dc-01',  cluster: 'Cluster-03', datacenter: 'DC-West', provisionedGb: 80,   writeThroughputMbps: 2.4,  writeIops: 120,  writeLatencyMs: 8.2 },
  { moref: 'vm-109', name: 'backup-srv-01',cluster: 'Cluster-03', datacenter: 'DC-West', provisionedGb: 8192, writeThroughputMbps: 180.0,writeIops: 5600, writeLatencyMs: 12.0 },
  { moref: 'vm-110', name: 'mon-01',        cluster: 'Cluster-01', datacenter: 'DC-East', provisionedGb: 100,  writeThroughputMbps: 1.2,  writeIops: 55,   writeLatencyMs: 9.0 },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Planner() {
  const [selected, setSelected]           = useState(new Set());
  const [journalIdx, setJournalIdx]       = useState(3);        // default: 1 day
  const [compression, setCompression]     = useState(50);       // default: 50%
  const [search, setSearch]               = useState('');

  const isMock = import.meta.env.VITE_MOCK_AUTH === 'true';

  const { data: liveVms = [], isLoading } = useQuery({
    queryKey: ['planner-vms'],
    queryFn:  queryPlannerVms,
    refetchInterval: REFRESH,
    enabled: !isMock,
  });

  const vms = isMock ? MOCK_VMS : liveVms;

  const filtered = useMemo(() =>
    vms.filter((vm) =>
      !search || vm.name.toLowerCase().includes(search.toLowerCase()) ||
      vm.cluster.toLowerCase().includes(search.toLowerCase()) ||
      vm.datacenter.toLowerCase().includes(search.toLowerCase())
    ),
    [vms, search]
  );

  const toggle = (moref) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(moref) ? next.delete(moref) : next.add(moref);
      return next;
    });

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((v) => v.moref)));
    }
  };

  const selectedVms = vms.filter((v) => selected.has(v.moref));
  const journalSec  = JOURNAL_OPTIONS[journalIdx].seconds;
  const ratio       = compression / 100;

  // ── Calculations ───────────────────────────────────────────────────────────
  const totalThroughputMbps  = selectedVms.reduce((s, v) => s + (v.writeThroughputMbps ?? 0), 0);
  const totalProvisionedGb   = selectedVms.reduce((s, v) => s + (v.provisionedGb ?? 0), 0);

  const bwRequiredMbps       = totalThroughputMbps * (1 - ratio);
  const journalStorageGb     = (totalThroughputMbps * (1 - ratio)) * (journalSec / 1024); // MB/s → GB over period
  const mirrorStorageGb      = totalProvisionedGb;
  const totalDrStorageGb     = journalStorageGb + mirrorStorageGb;

  // ── Export ─────────────────────────────────────────────────────────────────
  const exportCsv = () => {
    const rows = [
      ['VM Name', 'Cluster', 'Datacenter', 'Provisioned (GB)', 'Write Throughput (Mbps)', 'Write IOPS'],
      ...selectedVms.map((v) => [
        v.name, v.cluster, v.datacenter,
        (v.provisionedGb ?? 0).toFixed(1),
        (v.writeThroughputMbps ?? 0).toFixed(2),
        (v.writeIops ?? 0).toFixed(0),
      ]),
      [],
      ['--- Summary ---'],
      ['Journal Retention', JOURNAL_OPTIONS[journalIdx].label],
      ['Compression', `${compression}%`],
      ['Bandwidth Required', `${fmtMbps(bwRequiredMbps)}`],
      ['Journal Storage', `${fmtGb(journalStorageGb)}`],
      ['Mirror Storage', `${fmtGb(mirrorStorageGb)}`],
      ['Total DR Storage', `${fmtGb(totalDrStorageGb)}`],
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'zroc-planner-report.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const margin = 15;
    const pageW  = 210;
    const colW   = pageW - margin * 2;
    let y = margin;

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('zROC — DR Capacity Planner Report', margin, y);
    y += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
    y += 10;

    // Summary box
    doc.setDrawColor(14, 165, 233);
    doc.setFillColor(240, 248, 255);
    doc.roundedRect(margin, y, colW, 40, 2, 2, 'FD');
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Planning Parameters', margin + 4, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const params = [
      ['VMs selected', `${selected.size}`],
      ['Journal retention', JOURNAL_OPTIONS[journalIdx].label],
      ['WAN compression', `${compression}%`],
    ];
    params.forEach(([label, val], i) => {
      doc.setTextColor(80); doc.text(label, margin + 4, y + 15 + i * 7);
      doc.setTextColor(0);  doc.text(val, margin + 60, y + 15 + i * 7);
    });
    y += 48;

    // Results
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Capacity Estimates', margin, y);
    y += 6;
    const results = [
      ['Bandwidth Required',      fmtMbps(bwRequiredMbps), `Raw ${fmtMbps(totalThroughputMbps)} × ${100 - compression}%`],
      ['Journal Storage',         fmtGb(journalStorageGb), `${JOURNAL_OPTIONS[journalIdx].label} at ${fmtMbps(bwRequiredMbps)}`],
      ['Mirror Storage',          fmtGb(mirrorStorageGb),  'Full copy of selected VM disks'],
      ['Total DR Storage Footprint', fmtGb(totalDrStorageGb), 'Journal + Mirror combined'],
    ];
    results.forEach(([label, val, note]) => {
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80);
      doc.text(label, margin, y);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(0); doc.setFontSize(12);
      doc.text(val, margin + 70, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120);
      doc.text(note, margin + 110, y);
      y += 9;
    });
    y += 6;

    // VM table header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text('Selected VMs', margin, y);
    y += 5;
    doc.setFillColor(230, 240, 255);
    doc.rect(margin, y, colW, 6, 'F');
    doc.setFontSize(8);
    ['VM Name', 'Cluster', 'Datacenter', 'Disk (GB)', 'Write BW', 'IOPS'].forEach((h, i) => {
      doc.text(h, margin + [0, 50, 85, 120, 143, 163][i], y + 4);
    });
    y += 7;

    // VM rows
    doc.setFont('helvetica', 'normal');
    selectedVms.forEach((vm, idx) => {
      if (y > 270) { doc.addPage(); y = margin; }
      if (idx % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(margin, y - 1, colW, 6, 'F'); }
      doc.setTextColor(0);
      doc.setFontSize(8);
      [
        vm.name.slice(0, 24),
        (vm.cluster || '—').slice(0, 16),
        (vm.datacenter || '—').slice(0, 14),
        (vm.provisionedGb ?? 0).toFixed(1),
        fmtMbps(vm.writeThroughputMbps),
        (vm.writeIops ?? 0).toFixed(0),
      ].forEach((val, i) => doc.text(val, margin + [0, 50, 85, 120, 143, 163][i], y + 4));
      y += 6;
    });

    doc.save('zroc-planner-report.pdf');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calculator size={20} className="text-accent" />
          <h1 className="text-lg font-semibold text-text-primary">DR Capacity Planner</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={selected.size === 0}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors duration-150',
              selected.size > 0
                ? 'border-border text-text-secondary hover:bg-raised hover:text-text-primary'
                : 'text-text-muted border-border cursor-not-allowed opacity-50',
            )}
          >
            <Download size={13} />
            CSV
          </button>
          <button
            onClick={exportPdf}
            disabled={selected.size === 0}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors duration-150',
              selected.size > 0
                ? 'bg-accent text-canvas border-accent hover:bg-accent/80'
                : 'text-text-muted border-border cursor-not-allowed opacity-50',
            )}
          >
            <FileText size={13} />
            Export PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left — VM selector */}
        <div className="xl:col-span-2 card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="font-mono text-xs text-text-secondary uppercase tracking-wider">
              Select VMs to model
            </p>
            <span className="text-xs text-text-muted">
              {selected.size} / {vms.length} selected
            </span>
          </div>

          {/* Search */}
          <div className="px-4 py-2 border-b border-border">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter VMs…"
                className="w-full bg-raised border border-border rounded-md pl-7 pr-3 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      onChange={toggleAll}
                      className="accent-accent"
                    />
                  </th>
                  <th className="px-3 py-2 text-left section-title">VM</th>
                  <th className="px-3 py-2 text-left section-title">Cluster</th>
                  <th className="px-3 py-2 text-left section-title">Datacenter</th>
                  <th className="px-3 py-2 text-right section-title">Disk Size</th>
                  <th className="px-3 py-2 text-right section-title">Write BW</th>
                  <th className="px-3 py-2 text-right section-title">Write IOPS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading && !isMock ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">Loading VMs…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">No VMs found</td></tr>
                ) : (
                  filtered.map((vm) => (
                    <VmRow
                      key={vm.moref}
                      vm={vm}
                      selected={selected.has(vm.moref)}
                      onToggle={() => toggle(vm.moref)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right — inputs + results */}
        <div className="space-y-4">
          {/* Inputs */}
          <div className="card p-4 space-y-5">
            <p className="font-mono text-xs text-text-secondary uppercase tracking-wider border-b border-border pb-2">
              Planning Inputs
            </p>

            {/* Journal retention */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="section-title">Journal Retention</label>
                <span className="font-mono text-xs text-accent font-semibold">
                  {JOURNAL_OPTIONS[journalIdx].label}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={JOURNAL_OPTIONS.length - 1}
                value={journalIdx}
                onChange={(e) => setJournalIdx(Number(e.target.value))}
                className="w-full accent-accent"
              />
              <div className="flex justify-between text-[9px] text-text-muted font-mono mt-1">
                <span>1h</span><span>8h</span><span>7d</span><span>15d</span><span>30d</span>
              </div>
            </div>

            {/* Compression */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="section-title">WAN Compression</label>
                <span className="font-mono text-xs text-accent font-semibold">{compression}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={80}
                step={5}
                value={compression}
                onChange={(e) => setCompression(Number(e.target.value))}
                className="w-full accent-accent"
              />
              <div className="flex justify-between text-[9px] text-text-muted font-mono mt-1">
                <span>0%</span><span>40%</span><span>80%</span>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="space-y-3">
            {selected.size === 0 && (
              <p className="text-xs text-text-muted text-center py-2">
                Select VMs to see estimates
              </p>
            )}
            <ResultCard
              icon={Wifi}
              label="Bandwidth Required"
              value={fmtMbps(bwRequiredMbps)}
              sub={`Raw: ${fmtMbps(totalThroughputMbps)} → ${compression}% compressed`}
              color="accent"
            />
            <ResultCard
              icon={HardDrive}
              label="Journal Storage"
              value={fmtGb(journalStorageGb)}
              sub={`${JOURNAL_OPTIONS[journalIdx].label} at ${fmtMbps(bwRequiredMbps)} after compression`}
              color="warn"
            />
            <ResultCard
              icon={Database}
              label="Mirror Storage"
              value={fmtGb(mirrorStorageGb)}
              sub="Full copy of selected VM disks"
              color="ok"
            />
            <div className="card p-4 border-accent/20 bg-accent/5">
              <p className="section-title mb-1">Total DR Storage Footprint</p>
              <p className="font-data text-3xl font-semibold text-accent data-value">
                {fmtGb(totalDrStorageGb)}
              </p>
              <p className="text-xs text-text-muted mt-1">
                Journal + Mirror across {selected.size} VM{selected.size !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
