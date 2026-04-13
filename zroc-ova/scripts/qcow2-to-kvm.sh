#!/usr/bin/env bash
# qcow2-to-kvm.sh — Package a QEMU qcow2 image as a KVM/libvirt/Proxmox artifact.
#
# Usage: qcow2-to-kvm.sh <qemu_output_dir/vm_name> <output.qcow2>
#
# Example:
#   qcow2-to-kvm.sh ../output/qemu/zroc-appliance-1.0.0 \
#                   ../output/zroc-appliance-1.0.0-ubuntu-24.04-amd64.qcow2

set -euo pipefail

QEMU_VM_PATH="$1"   # path to qcow2 (without extension) or directory
QCOW2_OUT="$2"      # destination .qcow2 file

# ── Locate the source qcow2 ───────────────────────────────────────────────────
if [[ -f "${QEMU_VM_PATH}.qcow2" ]]; then
  QCOW2_SRC="${QEMU_VM_PATH}.qcow2"
elif [[ -d "$QEMU_VM_PATH" ]]; then
  QCOW2_SRC=$(find "$QEMU_VM_PATH" -name "*.qcow2" | head -1)
else
  QCOW2_SRC="$QEMU_VM_PATH"
fi

if [[ -z "$QCOW2_SRC" || ! -f "$QCOW2_SRC" ]]; then
  echo "ERROR: could not find qcow2 image at ${QEMU_VM_PATH}" >&2
  exit 1
fi

echo "==> [qcow2-to-kvm] Source qcow2: $QCOW2_SRC"
echo "==> [qcow2-to-kvm] Output qcow2: $QCOW2_OUT"

mkdir -p "$(dirname "$QCOW2_OUT")"

# Re-encode with qemu-img to compact/sparsify and ensure compatibility.
# subformat=compressed produces a space-efficient image suitable for distribution.
echo "==> [qcow2-to-kvm] Compacting qcow2 for distribution…"
qemu-img convert \
  -f qcow2 \
  -O qcow2 \
  -o compression_type=zlib,preallocation=off \
  "$QCOW2_SRC" \
  "$QCOW2_OUT"

SIZE=$(du -sh "$QCOW2_OUT" | cut -f1)
SHA=$(sha256sum "$QCOW2_OUT" | awk '{print $1}')

echo "==> [qcow2-to-kvm] qcow2 complete: $QCOW2_OUT ($SIZE)"
echo "==> [qcow2-to-kvm] SHA256: $SHA"
echo "$SHA  $(basename "$QCOW2_OUT")" > "${QCOW2_OUT}.sha256"
echo "==> [qcow2-to-kvm] Done"
