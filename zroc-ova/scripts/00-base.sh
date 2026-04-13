#!/usr/bin/env bash
# zroc-ova/scripts/00-base.sh
set -euo pipefail

echo "==> [00-base] Configuring base system"

while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; do sleep 2; done

export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get upgrade -y
apt-get dist-upgrade -y

timedatectl set-timezone UTC

cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF

cat >> /etc/sysctl.d/99-zroc.conf << 'EOF'
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.tcp_syncookies = 1
fs.suid_dumpable = 0
kernel.core_pattern = |/bin/false
EOF

sysctl --system

sed -i 's/#PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config

apt-get install -y ufw
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment 'SSH'
ufw allow 80/tcp   comment 'HTTP redirect'
ufw allow 443/tcp  comment 'HTTPS — zROC dashboard'
ufw allow 3000/tcp comment 'Grafana (optional direct access)'
ufw --force enable

echo "==> [00-base] Done"
