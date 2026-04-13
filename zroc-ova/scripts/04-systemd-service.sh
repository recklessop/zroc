#!/usr/bin/env bash
# zroc-ova/scripts/04-systemd-service.sh
set -euo pipefail
echo "==> [04-systemd-service] Installing zroc.service"

cat > /etc/systemd/system/zroc.service << 'EOF'
[Unit]
Description=zROC Observability Stack
Documentation=https://github.com/ZertoPublic/zroc
After=docker.service network-online.target
Requires=docker.service
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
User=zroc
Group=zroc
WorkingDirectory=/opt/zroc
EnvironmentFile=-/opt/zroc/.env
ExecStartPre=/usr/bin/docker compose pull --quiet
ExecStart=/usr/bin/docker compose up -d --remove-orphans
ExecStop=/usr/bin/docker compose down
ExecReload=/usr/bin/docker compose up -d --remove-orphans
TimeoutStartSec=180
TimeoutStopSec=60

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
echo "==> [04-systemd-service] Done"
