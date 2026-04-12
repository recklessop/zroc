# zROC — Zerto Resiliency Observation Console

> A self-hosted, purpose-built observability dashboard for Zerto — replaces Zerto Analytics with a fast, always-on UI.

## Overview

zROC is a Docker Compose stack that collects Zerto metrics via the ZVM REST API and presents them in a polished web interface.

| Component | Role |
|---|---|
| Zerto Exporter | Scrapes ZVM & vCenter APIs, exposes Prometheus metrics |
| Prometheus | Stores metrics with 30-day retention |
| zROC UI | React + Express — authenticated dashboard |
| Authentik | Identity provider — login, 2FA, SSO, user management |
| Caddy | TLS termination |
| Grafana | Legacy dashboards |

## Quick Start

```bash
git clone https://github.com/ZertoPublic/zroc.git
cd zroc
cp .env.example .env
# Edit .env with your ZVM credentials and secrets
docker compose up -d
```

## Pages

| Page | Path | Description |
|---|---|---|
| Overview | `/` | NOC dashboard — health bar, site cards, VPG heat grid |
| VPG Monitor | `/vpgs` | Per-VPG: RPO gauge, throughput/IOPS charts, journal health |
| VM Protection | `/vms` | All VMs — RPO, journal usage, encryption %, drill-down |
| VRA Infrastructure | `/vras` | CPU/memory usage, protected/recovery workload |
| Encryption Detection | `/encryption` | Encryption % per VM, anomaly table |
| Storage | `/storage` | Datastore capacity with Zerto usage breakdown |
| User Management | `/settings/users` | Admin only — full CRUD + 2FA QR setup |

## Architecture

```
Browser → Caddy (TLS) → zroc-ui (Express + React SPA)
                       → Authentik (OIDC auth)
zroc-ui → Prometheus → Zerto Exporter → ZVM API
```

## License

Apache 2.0
