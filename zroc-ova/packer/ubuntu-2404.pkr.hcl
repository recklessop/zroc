packer {
  required_version = ">= 1.10.0"
  required_plugins {
    vmware = {
      source  = "github.com/hashicorp/vmware"
      version = "~> 1.0"
    }
    qemu = {
      source  = "github.com/hashicorp/qemu"
      version = "~> 1.0"
    }
  }
}

variable "ubuntu_iso_url" {
  type    = string
  default = "https://releases.ubuntu.com/24.04/ubuntu-24.04.2-live-server-amd64.iso"
}

variable "ubuntu_iso_checksum" {
  type    = string
  default = "file:https://releases.ubuntu.com/24.04/SHA256SUMS"
}

variable "vm_name" {
  type    = string
  default = "zroc-appliance"
}

variable "vm_version" {
  type    = string
  default = "1.0.0"
}

variable "disk_size_mb" {
  type    = number
  default = 102400
}

variable "memory_mb" {
  type    = number
  default = 8192
}

variable "cpus" {
  type    = number
  default = 4
}

variable "output_dir" {
  type    = string
  default = "../output"
}

variable "headless" {
  type    = bool
  default = true
}

source "vmware-iso" "ubuntu2404" {
  vm_name               = "${var.vm_name}-${var.vm_version}"
  guest_os_type         = "ubuntu-64"
  headless              = var.headless
  iso_url               = var.ubuntu_iso_url
  iso_checksum          = var.ubuntu_iso_checksum
  disk_size             = var.disk_size_mb
  disk_adapter_type     = "pvscsi"
  memory                = var.memory_mb
  cpus                  = var.cpus
  network_adapter_type  = "vmxnet3"
  network               = "nat"
  disk_type_id          = 0
  http_directory        = "http"
  http_port_min         = 8100
  http_port_max         = 8199
  boot_wait             = "5s"
  boot_command = [
    "e<wait>",
    "<down><down><down><end>",
    " autoinstall ds=nocloud-net;seedfrom=http://{{.HTTPIP}}:{{.HTTPPort}}/",
    "<f10><wait30s>",
  ]
  ssh_username          = "zroc"
  ssh_password          = "zroc-setup-temp"
  ssh_timeout           = "30m"
  ssh_port              = 22
  shutdown_command      = "echo 'zroc-setup-temp' | sudo -S shutdown -P now"
  output_directory      = "${var.output_dir}/vmware"
  skip_export           = false
  format                = "ovf"
  vmx_data = {
    "virtualHW.version" = "19"
    "tools.syncTime"    = "TRUE"
    "annotation"        = "zROC Appliance v${var.vm_version}"
    "guestOS"           = "ubuntu-64"
  }
}

source "qemu" "ubuntu2404" {
  vm_name          = "${var.vm_name}-${var.vm_version}"
  iso_url          = var.ubuntu_iso_url
  iso_checksum     = var.ubuntu_iso_checksum
  disk_size        = "${var.disk_size_mb}M"
  disk_interface   = "virtio"
  memory           = var.memory_mb
  cpus             = var.cpus
  accelerator      = "kvm"
  headless         = true
  http_directory   = "http"
  http_port_min    = 8100
  http_port_max    = 8199
  boot_wait        = "5s"
  boot_command = [
    "e<wait>",
    "<down><down><down><end>",
    " autoinstall ds=nocloud-net;seedfrom=http://{{.HTTPIP}}:{{.HTTPPort}}/",
    "<f10><wait60s>",
  ]
  ssh_username     = "zroc"
  ssh_password     = "zroc-setup-temp"
  ssh_timeout      = "45m"
  shutdown_command = "echo 'zroc-setup-temp' | sudo -S shutdown -P now"
  output_directory = "${var.output_dir}/qemu"
  format           = "qcow2"
}

build {
  name    = "zroc-appliance"
  sources = ["source.vmware-iso.ubuntu2404"]

  # Copy overlay files (setup wizard, etc.) into the VM before provisioning
  provisioner "file" {
    source      = "../overlays/"
    destination = "/tmp/overlays/"
  }

  provisioner "shell" {
    script            = "../scripts/00-base.sh"
    execute_command   = "echo 'zroc-setup-temp' | sudo -S bash {{.Path}}"
    expect_disconnect = true
  }

  provisioner "shell" {
    script          = "../scripts/01-docker.sh"
    execute_command = "echo 'zroc-setup-temp' | sudo -S bash {{.Path}}"
    pause_before    = "15s"
  }

  provisioner "shell" {
    script          = "../scripts/02-zroc.sh"
    execute_command = "echo 'zroc-setup-temp' | sudo -S bash {{.Path}}"
  }

  provisioner "shell" {
    script          = "../scripts/03-setup-wizard.sh"
    execute_command = "echo 'zroc-setup-temp' | sudo -S bash {{.Path}}"
  }

  provisioner "shell" {
    script          = "../scripts/04-systemd-service.sh"
    execute_command = "echo 'zroc-setup-temp' | sudo -S bash {{.Path}}"
  }

  provisioner "shell" {
    script          = "../scripts/05-cleanup.sh"
    execute_command = "echo 'zroc-setup-temp' | sudo -S bash {{.Path}}"
  }

  post-processor "shell-local" {
    only = ["vmware-iso.ubuntu2404"]
    inline = [
      "cd ${var.output_dir}/vmware",
      "ovftool --compress=9 *.ovf ../${var.vm_name}-${var.vm_version}-ubuntu-24.04-amd64.ova",
      "cd ..",
      "sha256sum ${var.vm_name}-${var.vm_version}-ubuntu-24.04-amd64.ova > ${var.vm_name}-${var.vm_version}-ubuntu-24.04-amd64.ova.sha256",
      "echo 'OVA packaged successfully'",
    ]
  }
}
