# zroc-ova/Makefile
VERSION     ?= 1.0.0
PACKER_DIR   = packer
OUTPUT_DIR   = output
OVA_NAME     = zroc-appliance-$(VERSION)-ubuntu-26.04-amd64.ova

.PHONY: all init validate build build-qemu package checksum clean help

all: build package checksum

init:
	cd $(PACKER_DIR) && packer init ubuntu-2604.pkr.hcl

validate: init
	cd $(PACKER_DIR) && packer validate \
		-var "vm_version=$(VERSION)" \
		-var-file=variables.pkrvars.hcl \
		ubuntu-2604.pkr.hcl
	@echo "✓ Template valid"

build: init
	@echo "==> Building zROC OVA v$(VERSION) with VMware builder"
	cd $(PACKER_DIR) && PACKER_LOG=1 packer build \
		-var "vm_version=$(VERSION)" \
		-var "headless=true" \
		-var-file=variables.pkrvars.hcl \
		ubuntu-2604.pkr.hcl
	@echo "✓ Build complete"

build-qemu: init
	@echo "==> Building zROC image v$(VERSION) with QEMU builder"
	cd $(PACKER_DIR) && PACKER_LOG=1 packer build \
		-only="qemu.ubuntu2604" \
		-var "vm_version=$(VERSION)" \
		-var-file=variables.pkrvars.hcl \
		ubuntu-2604.pkr.hcl

package:
	@echo "==> Packaging OVF to OVA"
	@OVF=$$(find $(OUTPUT_DIR)/vmware -name "*.ovf" | head -1); \
	if [ -z "$$OVF" ]; then echo "No OVF found in $(OUTPUT_DIR)/vmware"; exit 1; fi; \
	ovftool --compress=9 "$$OVF" "$(OUTPUT_DIR)/$(OVA_NAME)"
	@echo "✓ OVA: $(OUTPUT_DIR)/$(OVA_NAME)"

checksum:
	@cd $(OUTPUT_DIR) && sha256sum $(OVA_NAME) > $(OVA_NAME).sha256
	@echo "✓ Checksum: $(OUTPUT_DIR)/$(OVA_NAME).sha256"
	@cat $(OUTPUT_DIR)/$(OVA_NAME).sha256

verify:
	@cd $(OUTPUT_DIR) && sha256sum -c $(OVA_NAME).sha256

clean:
	rm -rf $(OUTPUT_DIR)
	@echo "✓ Output directory cleaned"

help:
	@echo ""
	@echo "  zroc-ova build targets"
	@echo "  ──────────────────────────────────────────"
	@grep -E '^## ' Makefile | sed 's/## /  make /'
	@echo ""
	@echo "  VERSION=$(VERSION)  (override: make build VERSION=1.1.0)"
	@echo ""
