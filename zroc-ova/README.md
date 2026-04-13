# zroc-ova — zROC Appliance Builder

Packer build definitions and provisioner scripts for the **zROC Ubuntu 26.04 LTS OVA appliance**.

## What you get

A 100 GB thin-provisioned VMware OVA containing:
- Ubuntu Server 26.04 LTS
- Docker Engine + Compose plugin
- Full zROC stack (cloned from recklessop/zroc)
- Interactive first-boot setup wizard (`zroc-setup`)
- UFW firewall pre-configured (22, 80, 443, 3000)
- VMware guest tools (`open-vm-tools`)
- Automatic security patches (`unattended-upgrades`)

## Build

```bash
git clone https://github.com/recklessop/zroc-ova.git
cd zroc-ova
make init
make validate
make build VERSION=1.0.0
make package VERSION=1.0.0
make checksum VERSION=1.0.0
```

## Deploy

1. Import the OVA into vSphere
2. Allocate: 4 vCPU, 8 GB RAM, 100 GB thin datastore
3. Power on — setup wizard launches automatically
4. Follow the 6-step wizard
5. Access: `https://<appliance-ip>`

## VM Requirements

| | Minimum | Recommended |
|---|---|---|
| vCPU | 2 | 4 |
| RAM | 6 GB | 8 GB |
| Disk | 100 GB thin | 100 GB thin |
| vSphere | 7.0+ | 8.x |

## License

Apache 2.0
