#!/usr/bin/env bash
# zroc-ova/scripts/02-zroc.sh
set -euo pipefail
echo "==> [02-zroc] Setting up zROC installation"

INSTALL_DIR=/opt/zroc
ZROC_REPO="https://github.com/ZertoPublic/zroc.git"

git clone --depth=1 "$ZROC_REPO" "$INSTALL_DIR"

mkdir -p \
  "$INSTALL_DIR/certs"        \
  "$INSTALL_DIR/zvmexporter"  \
  "$INSTALL_DIR/data"

cd "$INSTALL_DIR"

docker compose pull prometheus grafana authentik-server authentik-worker \
  || echo "[02-zroc] Some images not yet available — will pull on first start"

chown -R zroc:zroc "$INSTALL_DIR"

echo "==> [02-zroc] Installation directory: $INSTALL_DIR"
echo "==> [02-zroc] Done"
