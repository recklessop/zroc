# zroc-ova/Makefile — Build and manage zROC appliance images
VERSION     ?= 1.0.0
PACKER_DIR   = packer
OUTPUT_DIR   = output
VM_NAME      = zroc-appliance
ARTIFACT_PFX = $(VM_NAME)-$(VERSION)-ubuntu-24.04-amd64

.PHONY: all build validate clean init docker-build docker-push help

all: build ## Build everything (default)

help: ## Show available targets
	@echo ""
	@echo "  zroc-ova build targets"
	@echo "  ────────────────────────────────────────"
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  make %-15s %s\n", $$1, $$2}'
	@echo ""
	@echo "  VERSION=$(VERSION)  (override: make build VERSION=1.1.0)"
	@echo ""

init: ## Install required Packer plugins
	cd $(PACKER_DIR) && packer init ubuntu-2404.pkr.hcl

validate: ## Validate Packer config
	cd $(PACKER_DIR) && packer validate \
		-var "vm_version=$(VERSION)" \
		-var-file=variables.pkrvars.hcl \
		ubuntu-2404.pkr.hcl

build: validate ## Build OVA + qcow2 appliance images
	cd $(PACKER_DIR) && packer build \
		-var "vm_version=$(VERSION)" \
		-var-file=variables.pkrvars.hcl \
		ubuntu-2404.pkr.hcl
	@echo ""
	@echo "Artifacts:"
	@ls -lh $(OUTPUT_DIR)/$(ARTIFACT_PFX).ova $(OUTPUT_DIR)/$(ARTIFACT_PFX).qcow2 2>/dev/null
	@echo ""
	@cat $(OUTPUT_DIR)/$(ARTIFACT_PFX).ova.sha256 $(OUTPUT_DIR)/$(ARTIFACT_PFX).qcow2.sha256 2>/dev/null

clean: ## Remove all build artifacts
	rm -rf $(OUTPUT_DIR)/qemu $(OUTPUT_DIR)/$(VM_NAME)-*
	@echo "Build artifacts cleaned"

docker-build: ## Build zroc-ui Docker image
	cd ../zroc-ui && docker build --network=host \
		-t recklessop/zroc-ui:stable \
		-t recklessop/zroc-ui:$(VERSION) \
		-t recklessop/zroc-ui:latest \
		.

docker-push: ## Push zroc-ui Docker image to Docker Hub
	docker push recklessop/zroc-ui:stable
	docker push recklessop/zroc-ui:$(VERSION)
	docker push recklessop/zroc-ui:latest
