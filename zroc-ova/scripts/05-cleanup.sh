#!/usr/bin/env bash
# zroc-ova/scripts/05-cleanup.sh
set -euo pipefail
echo "==> [05-cleanup] Cleaning build artefacts"

rm -f /etc/sudoers.d/zroc-packer

apt-get autoremove -y
apt-get autoclean -y
apt-get clean
rm -rf /var/lib/apt/lists/*

journalctl --rotate
journalctl --vacuum-time=1s
find /var/log -type f -name "*.log" -delete
find /var/log -type f -name "*.gz"  -delete
truncate -s 0 /var/log/wtmp /var/log/btmp /var/log/lastlog 2>/dev/null || true

unset HISTFILE
rm -f /home/zroc/.bash_history /root/.bash_history
history -c

cloud-init clean --logs 2>/dev/null || true

rm -rf /tmp/* /var/tmp/*

echo "==> [05-cleanup] Zeroing free space (this takes a moment)…"
dd if=/dev/zero of=/ZERO bs=4M status=progress 2>/dev/null || true
rm -f /ZERO
sync

SWAP_DEV=$(swapon --show=NAME --noheadings 2>/dev/null | head -1)
if [[ -n "$SWAP_DEV" ]]; then
  swapoff "$SWAP_DEV"
  dd if=/dev/zero of="$SWAP_DEV" bs=4M status=progress 2>/dev/null || true
  mkswap "$SWAP_DEV"
fi

echo "==> [05-cleanup] Done — image ready for OVA packaging"
