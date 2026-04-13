packer {
  required_version = ">= 1.10.0"
  required_plugins {
    qemu = {
      source  = "github.com/hashicorp/qemu"
      version = "~> 1.0"
    }
  }
}

variable "ubuntu_iso_url" {
  type    = string
  default = "https://releases.ubuntu.com/24.04/ubuntu-24.04.4-live-server-amd64.iso"
}

variable "ubuntu_iso_checksum" {
  type    = string
  default = "sha256:e907d92eeec9df64163a7e454cbc8d7755e8ddc7ed42f99dbc80c40f1a138433"
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

source "qemu" "ubuntu2404" {
  vm_name          = "${var.vm_name}-${var.vm_version}"
  iso_url          = var.ubuntu_iso_url
  iso_checksum     = var.ubuntu_iso_checksum
  disk_size        = "${var.disk_size_mb}M"
  disk_interface   = "virtio"
  format           = "qcow2"
  memory           = var.memory_mb
  cpus             = var.cpus
  accelerator      = "kvm"
  headless         = true
  http_directory   = "http"
  http_port_min    = 8100
  http_port_max    = 8199
  boot_wait        = "10s"
  boot_command = [
    "e<wait3s>",
    "<down><down><down><end>",
    " autoinstall ds=nocloud-net\\;s=http://{{.HTTPIP}}:{{.HTTPPort}}/",
    "<f10>",
  ]
  ssh_username     = "zroc"
  ssh_password     = "zroc-setup-temp"
  ssh_timeout      = "45m"
  shutdown_command = "echo 'zroc-setup-temp' | sudo -S shutdown -P now"
  output_directory = "${var.output_dir}/qemu"
}

build {
  name    = "zroc-appliance"
  sources = ["source.qemu.ubuntu2404"]

  # Copy overlay files (setup wizard binary, etc.) into the VM
  # Create destination first, then upload overlay contents
  provisioner "shell" {
    inline = ["mkdir -p /tmp/overlays"]
  }

  provisioner "file" {
    source      = "../overlays/"
    destination = "/tmp/overlays"
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

  # Convert qcow2 → VMDK → OVA (no ovftool required)
  post-processor "shell-local" {
    inline = [
      "bash ../scripts/qcow2-to-ova.sh ${var.output_dir}/qemu/${var.vm_name}-${var.vm_version} ${var.output_dir}/${var.vm_name}-${var.vm_version}-ubuntu-24.04-amd64.ova ${var.vm_name} ${var.vm_version}",
    ]
  }

  # Produce a KVM/libvirt/Proxmox-compatible qcow2 artifact
  post-processor "shell-local" {
    inline = [
      "bash ../scripts/qcow2-to-kvm.sh ${var.output_dir}/qemu/${var.vm_name}-${var.vm_version} ${var.output_dir}/${var.vm_name}-${var.vm_version}-ubuntu-24.04-amd64.qcow2",
    ]
  }
}
