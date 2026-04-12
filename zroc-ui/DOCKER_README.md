# zROC UI

**Zerto Resiliency Observation Console** — a purpose-built observability frontend for Zerto that replaces Zerto Analytics with a self-hosted, always-on dashboard.

## What it does

- **NOC Dashboard** — VPG health heat grid, site cards, RPO status at a glance
- **VPG Monitor** — per-VPG RPO history, throughput/IOPS charts, journal health, VM breakdown
- **VM Protection** — per-VM drill-down with RPO trends, journal gauges, encryption trends
- **VRA Infrastructure** — CPU/memory usage, workload counts, volume capacity
- **Encryption Detection** — near real-time ransomware anomaly detection
- **Storage** — datastore capacity with Zerto-attributed journal/scratch/recovery breakdown
- **User Management** — full CRUD with 2FA QR code setup, group management, enterprise IdP integration

## Authentication

This image includes a Node.js Express backend that handles:
- OIDC login via **Authentik** (bundled in the full stack)
- 2FA enforcement (TOTP with QR codes)
- Enterprise IdP integration (Azure AD, Okta, SAML, LDAP)
- Rate-limited login, `httpOnly` session cookies, zero Prometheus exposure to browser

## Quick start — full stack

```bash
git clone https://github.com/ZertoPublic/zroc.git
cd zroc
cp .env.example .env
# Edit .env with your ZVM credentials and secrets
docker compose up -d
```

Then visit `https://<your-host>` — on first access run through the setup wizard.

## Environment variables

|Variable                 |Required|Description                                            |
|-------------------------|--------|-------------------------------------------------------|
|`PROMETHEUS_URL`         |No      |Prometheus endpoint (default: `http://prometheus:9090`)|
|`AUTHENTIK_URL`          |Yes     |Authentik server URL                                   |
|`AUTHENTIK_CLIENT_ID`    |Yes     |OIDC client ID registered in Authentik                 |
|`AUTHENTIK_CLIENT_SECRET`|Yes     |OIDC client secret                                     |
|`AUTHENTIK_ADMIN_TOKEN`  |Yes     |Authentik API token for user management                |
|`PUBLIC_URL`             |Yes     |Public HTTPS URL of the appliance                      |
|`SESSION_SECRET`         |Yes     |Random secret for session signing (min 32 chars)       |
|`AUTHENTIK_ADMIN_GROUP`  |No      |Group name for admin role (default: `zroc-admins`)     |
|`AUTHENTIK_VIEWER_GROUP` |No      |Group name for viewer role (default: `zroc-viewers`)   |

## Image tags

|Tag     |Description                              |
|--------|-----------------------------------------|
|`stable`|Latest stable release — use in production|
|`latest`|Alias for stable                         |
|`1.x.x` |Pinned semantic version                  |

## Source

- UI & backend: [github.com/ZertoPublic/zroc](https://github.com/ZertoPublic/zroc)
- Zerto Exporter: [github.com/recklessop/Zerto_Exporter](https://github.com/recklessop/Zerto_Exporter)
- OVA Appliance: [github.com/ZertoPublic/zroc-ova](https://github.com/ZertoPublic/zroc-ova)

## License

Apache 2.0 — open source, not officially supported by Zerto/HPE.
