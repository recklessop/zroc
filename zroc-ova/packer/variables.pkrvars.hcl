# zroc-ova/packer/variables.pkrvars.hcl
vm_version = "1.0.0"

ubuntu_iso_url      = "https://releases.ubuntu.com/24.04/ubuntu-24.04.4-live-server-amd64.iso"
ubuntu_iso_checksum = "sha256:e907d92eeec9df64163a7e454cbc8d7755e8ddc7ed42f99dbc80c40f1a138433"

memory_mb    = 8192
cpus         = 4
disk_size_mb = 102400

output_dir = "../output"
