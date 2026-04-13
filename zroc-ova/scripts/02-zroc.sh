#!/usr/bin/env bash
# zroc-ova/scripts/02-zroc.sh
set -euo pipefail
echo "==> [02-zroc] Setting up zROC installation"

INSTALL_DIR=/opt/zroc
ZROC_REPO="https://github.com/recklessop/zroc.git"

git clone --depth=1 "$ZROC_REPO" "$INSTALL_DIR"

# Ensure expected directories exist
mkdir -p \
  "$INSTALL_DIR/certs"       \
  "$INSTALL_DIR/zvmexporter" \
  "$INSTALL_DIR/data"

cd "$INSTALL_DIR"

# Pre-pull all container images into the OVA image layer so first-boot is fast.
# Failures are non-fatal — any missing images will be pulled on first docker compose up.
echo "==> [02-zroc] Pre-pulling container images (this may take a while)…"
docker compose pull \
  caddy \
  zroc-ui \
  authentik-postgresql \
  authentik-redis \
  authentik-server \
  authentik-worker \
  zertoexporter \
  zroc-prometheus \
  grafana \
  watchtower \
  || echo "[02-zroc] Warning: some images could not be pre-pulled — they will pull on first start"

chown -R zroc:zroc "$INSTALL_DIR"

echo "==> [02-zroc] Installation directory: $INSTALL_DIR"
echo "==> [02-zroc] Done"
