#!/usr/bin/env bash
# qcow2-to-ova.sh — Convert a QEMU qcow2 disk image to a VMware-compatible OVA
# without requiring ovftool.
#
# Usage: qcow2-to-ova.sh <qemu_output_dir/vm_name> <output.ova> <vm_display_name> <version>
#
# Example:
#   qcow2-to-ova.sh ../output/qemu/zroc-appliance-1.0.0 \
#                   ../output/zroc-appliance-1.0.0-ubuntu-24.04-amd64.ova \
#                   zroc-appliance 1.0.0

set -euo pipefail

QEMU_VM_PATH="$1"   # path to the qcow2 file (without extension) or directory
OVA_OUT="$2"        # destination .ova file
VM_NAME="$3"        # display name inside the OVF
VM_VERSION="$4"     # version string

# ── Locate the qcow2 ──────────────────────────────────────────────────────────
if [[ -f "${QEMU_VM_PATH}.qcow2" ]]; then
  QCOW2="${QEMU_VM_PATH}.qcow2"
elif [[ -d "$QEMU_VM_PATH" ]]; then
  QCOW2=$(find "$QEMU_VM_PATH" -name "*.qcow2" | head -1)
else
  # Packer QEMU plugin writes <vm_name> (no extension) as the output file
  QCOW2="$QEMU_VM_PATH"
fi

if [[ -z "$QCOW2" || ! -f "$QCOW2" ]]; then
  echo "ERROR: could not find qcow2 image at ${QEMU_VM_PATH}" >&2
  exit 1
fi

echo "==> [qcow2-to-ova] Source qcow2: $QCOW2"
echo "==> [qcow2-to-ova] Output OVA:   $OVA_OUT"

WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

VMDK_NAME="${VM_NAME}-disk1.vmdk"
OVF_NAME="${VM_NAME}.ovf"
MF_NAME="${VM_NAME}.mf"

# ── 1. Convert qcow2 → stream-optimised VMDK ─────────────────────────────────
echo "==> [qcow2-to-ova] Converting qcow2 → VMDK (stream-optimised)…"
qemu-img convert \
  -f qcow2 \
  -O vmdk \
  -o subformat=streamOptimized,adapter_type=lsilogic,compat6 \
  "$QCOW2" \
  "${WORK_DIR}/${VMDK_NAME}"

DISK_SIZE_BYTES=$(qemu-img info --output=json "${WORK_DIR}/${VMDK_NAME}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['virtual-size'])")
DISK_SIZE_GB=$(( (DISK_SIZE_BYTES + 1073741823) / 1073741824 ))
DISK_FILE_BYTES=$(stat -c%s "${WORK_DIR}/${VMDK_NAME}")

echo "==> [qcow2-to-ova] VMDK: virtual=${DISK_SIZE_GB}GB, file=${DISK_FILE_BYTES} bytes"

# ── 2. Generate OVF descriptor ────────────────────────────────────────────────
echo "==> [qcow2-to-ova] Generating OVF descriptor…"
cat > "${WORK_DIR}/${OVF_NAME}" << OVFEOF
<?xml version="1.0" encoding="UTF-8"?>
<Envelope xmlns="http://schemas.dmtf.org/ovf/envelope/1"
          xmlns:cim="http://schemas.dmtf.org/wbem/wscim/1/common"
          xmlns:ovf="http://schemas.dmtf.org/ovf/envelope/1"
          xmlns:rasd="http://schemas.dmtf.org/wbem/wscim/1/cim-schema/2/CIM_ResourceAllocationSettingData"
          xmlns:vmw="http://www.vmware.com/schema/ovf"
          xmlns:vssd="http://schemas.dmtf.org/wbem/wscim/1/cim-schema/2/CIM_VirtualSystemSettingData"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <References>
    <File ovf:href="${VMDK_NAME}" ovf:id="file1" ovf:size="${DISK_FILE_BYTES}"/>
  </References>
  <DiskSection>
    <Info>Virtual disk information</Info>
    <Disk ovf:capacity="${DISK_SIZE_GB}" ovf:capacityAllocationUnits="byte * 2^30"
          ovf:diskId="vmdisk1" ovf:fileRef="file1"
          ovf:format="http://www.vmware.com/interfaces/specifications/vmdk.html#streamOptimized"
          ovf:populatedSize="${DISK_FILE_BYTES}"/>
  </DiskSection>
  <NetworkSection>
    <Info>The list of logical networks</Info>
    <Network ovf:name="VM Network">
      <Description>VM Network</Description>
    </Network>
  </NetworkSection>
  <VirtualSystem ovf:id="${VM_NAME}">
    <Info>zROC Observability Console Appliance v${VM_VERSION}</Info>
    <Name>${VM_NAME}</Name>
    <AnnotationSection>
      <Info>A human-readable annotation</Info>
      <Annotation>zROC Appliance v${VM_VERSION} — https://github.com/recklessop/zroc</Annotation>
    </AnnotationSection>
    <OperatingSystemSection ovf:id="94" vmw:osType="ubuntu64Guest">
      <Info>The kind of installed guest operating system</Info>
      <Description>Ubuntu Linux (64-bit)</Description>
    </OperatingSystemSection>
    <VirtualHardwareSection>
      <Info>Virtual hardware requirements</Info>
      <System>
        <vssd:ElementName>Virtual Hardware Family</vssd:ElementName>
        <vssd:InstanceID>0</vssd:InstanceID>
        <vssd:VirtualSystemIdentifier>${VM_NAME}</vssd:VirtualSystemIdentifier>
        <vssd:VirtualSystemType>vmx-19</vssd:VirtualSystemType>
      </System>
      <Item>
        <rasd:AllocationUnits>hertz * 10^6</rasd:AllocationUnits>
        <rasd:Description>Number of virtual CPUs</rasd:Description>
        <rasd:ElementName>4 virtual CPU(s)</rasd:ElementName>
        <rasd:InstanceID>1</rasd:InstanceID>
        <rasd:ResourceType>3</rasd:ResourceType>
        <rasd:VirtualQuantity>4</rasd:VirtualQuantity>
      </Item>
      <Item>
        <rasd:AllocationUnits>byte * 2^20</rasd:AllocationUnits>
        <rasd:Description>Memory Size</rasd:Description>
        <rasd:ElementName>8192 MB of memory</rasd:ElementName>
        <rasd:InstanceID>2</rasd:InstanceID>
        <rasd:ResourceType>4</rasd:ResourceType>
        <rasd:VirtualQuantity>8192</rasd:VirtualQuantity>
      </Item>
      <Item>
        <rasd:Address>0</rasd:Address>
        <rasd:Description>SCSI Controller</rasd:Description>
        <rasd:ElementName>SCSI Controller 0</rasd:ElementName>
        <rasd:InstanceID>3</rasd:InstanceID>
        <rasd:ResourceSubType>lsilogic</rasd:ResourceSubType>
        <rasd:ResourceType>6</rasd:ResourceType>
      </Item>
      <Item>
        <rasd:AddressOnParent>0</rasd:AddressOnParent>
        <rasd:ElementName>Hard Disk 1</rasd:ElementName>
        <rasd:HostResource>ovf:/disk/vmdisk1</rasd:HostResource>
        <rasd:InstanceID>4</rasd:InstanceID>
        <rasd:Parent>3</rasd:Parent>
        <rasd:ResourceType>17</rasd:ResourceType>
      </Item>
      <Item>
        <rasd:AddressOnParent>7</rasd:AddressOnParent>
        <rasd:AutomaticAllocation>true</rasd:AutomaticAllocation>
        <rasd:Connection>VM Network</rasd:Connection>
        <rasd:Description>VmxNet3 ethernet adapter</rasd:Description>
        <rasd:ElementName>Network Adapter 1</rasd:ElementName>
        <rasd:InstanceID>5</rasd:InstanceID>
        <rasd:ResourceSubType>VmxNet3</rasd:ResourceSubType>
        <rasd:ResourceType>10</rasd:ResourceType>
      </Item>
    </VirtualHardwareSection>
  </VirtualSystem>
</Envelope>
OVFEOF

# ── 3. Generate manifest (.mf) with SHA256 checksums ─────────────────────────
echo "==> [qcow2-to-ova] Generating manifest…"
OVF_SHA=$(sha256sum "${WORK_DIR}/${OVF_NAME}"  | awk '{print $1}')
VMDK_SHA=$(sha256sum "${WORK_DIR}/${VMDK_NAME}" | awk '{print $1}')
cat > "${WORK_DIR}/${MF_NAME}" << MFEOF
SHA256(${OVF_NAME})= ${OVF_SHA}
SHA256(${VMDK_NAME})= ${VMDK_SHA}
MFEOF

# ── 4. Package as OVA (tar, OVF first per spec) ───────────────────────────────
echo "==> [qcow2-to-ova] Packaging OVA…"
mkdir -p "$(dirname "$OVA_OUT")"
tar -C "$WORK_DIR" \
  --format=ustar \
  -cf "$OVA_OUT" \
  "${OVF_NAME}" \
  "${VMDK_NAME}" \
  "${MF_NAME}"

OVA_SIZE=$(du -sh "$OVA_OUT" | cut -f1)
OVA_SHA=$(sha256sum "$OVA_OUT" | awk '{print $1}')

echo "==> [qcow2-to-ova] OVA complete: $OVA_OUT ($OVA_SIZE)"
echo "==> [qcow2-to-ova] SHA256: $OVA_SHA"
echo "$OVA_SHA  $(basename "$OVA_OUT")" > "${OVA_OUT}.sha256"
echo "==> [qcow2-to-ova] Done"
