#!/usr/bin/env bash
# zroc-ova/scripts/03-setup-wizard.sh
set -euo pipefail
echo "==> [03-setup-wizard] Installing setup wizard"

# The Packer file provisioner copies overlays/ to /tmp/overlays/
# Mirror the full directory tree into place
cp -r /tmp/overlays/usr /
chmod 0755 /usr/local/bin/zroc-setup

# Override getty on tty1 to run the setup wizard on first boot.
# Once .env exists the override is removed and normal getty resumes.
mkdir -p /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/zroc-firstboot.conf << 'EOF'
[Service]
ExecStartPre=/bin/sh -c '[ ! -f /opt/zroc/.env ] || { rm -f /etc/systemd/system/getty@tty1.service.d/zroc-firstboot.conf && systemctl daemon-reload && exit 1; }'
ExecStart=
ExecStart=-/usr/local/bin/zroc-setup
StandardInput=tty
StandardOutput=tty
StandardError=tty
TTYVTDisallocate=yes
Restart=always
RestartSec=3
EOF

systemctl daemon-reload

rm -f /etc/sudoers.d/zroc-packer
cat > /etc/sudoers.d/zroc << 'EOF'
zroc ALL=(ALL) NOPASSWD: /usr/bin/docker, /usr/local/bin/zroc-setup, /usr/bin/systemctl restart zroc
EOF
chmod 440 /etc/sudoers.d/zroc

echo "==> [03-setup-wizard] Done"
