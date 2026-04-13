#!/usr/bin/env bash
# zroc-ova/scripts/03-setup-wizard.sh
set -euo pipefail
echo "==> [03-setup-wizard] Installing setup wizard"

# The Packer file provisioner copies overlays/ to /tmp/overlays/
# Mirror the full directory tree into place
cp -r /tmp/overlays/usr /
chmod 0755 /usr/local/bin/zroc-setup

cat > /etc/systemd/system/zroc-firstboot.service << 'EOF'
[Unit]
Description=zROC First-Boot Setup Wizard
After=network-online.target
Wants=network-online.target
ConditionPathExists=!/opt/zroc/.env

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/bin/zroc-setup
StandardInput=tty
TTYPath=/dev/tty1
StandardOutput=journal+console
StandardError=journal+console
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable zroc-firstboot.service

rm -f /etc/sudoers.d/zroc-packer
cat > /etc/sudoers.d/zroc << 'EOF'
zroc ALL=(ALL) NOPASSWD: /usr/bin/docker, /usr/local/bin/zroc-setup, /usr/bin/systemctl restart zroc
EOF
chmod 440 /etc/sudoers.d/zroc

echo "==> [03-setup-wizard] Done"
