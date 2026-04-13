# zroc-ova/packer/variables.pkrvars.hcl
vm_version = "1.0.0"

ubuntu_iso_url      = "https://releases.ubuntu.com/24.04/ubuntu-24.04.2-live-server-amd64.iso"
ubuntu_iso_checksum = "file:https://releases.ubuntu.com/24.04/SHA256SUMS"

memory_mb    = 8192
cpus         = 4
disk_size_mb = 102400

headless   = true
output_dir = "../output"
