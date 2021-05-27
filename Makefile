LANG = en_US.UTF-8
SHELL = /bin/bash
.SHELLFLAGS = -eu -o pipefail -c # run '/bin/bash ... -c /bin/cmd'
.ONESHELL:
.DEFAULT_GOAL = test

#
# Npm recipes
#
nvm_brew = /usr/local/opt/nvm/nvm.sh
ifneq ("$(wildcard $(nvm_brew))", "")
	nvm_sh = $(nvm_brew)
endif
nvm_default = $(HOME)/.nvm/nvm.sh
ifneq ("$(wildcard $(nvm_default))", "")
	nvm_sh = $(nvm_default)
endif
node_version = $(shell cat .nvmrc)
define npm
	@$(eval npm_args=$(1))
	/bin/bash -e -o pipefail -l -c "source $(nvm_sh) && nvm exec $(node_version) npm $(npm_args)"
endef

node_modules: ## Run 'npm ci' if directory doesn't exist
	$(call npm, ci)

.PHONY: lint
lint: node_modules ## Run npm lint
	$(call npm, run lint)

.PHONY: test
test: lint ## Run npm run test
	$(call npm, run test)

.PHONY: run
run: node_modules ## Run npm run start
	$(call npm, run start)

.PHONY: docker-build
docker-build: ## Build Docker dev container
	docker build \
		--no-cache \
		--progress=plain \
		--tag streamr/ethereum-watcher:dev .

.PHONY: log
log:
	streamr-docker-dev log -f ethereum-watcher

.PHONY: factory-reset
factory-reset: ## Run streamr-docker-dev factory-reset
	streamr-docker-dev factory-reset

.PHONY: wipe
wipe: ## Run streamr-docker-dev stop and wipe
	streamr-docker-dev wipe

.PHONY: start
start: ## Start Docker stack required for running ethereum watcher
	streamr-docker-dev start ethereum-watcher

.PHONY: stop
stop: ## Run streamr-docker-dev stop
	streamr-docker-dev stop

.PHONY: pull
pull: ## Run streamr-docker-dev pull
	streamr-docker-dev pull

.PHONY: ps
ps: ## Run streamr-docker-dev ps
	streamr-docker-dev ps

.PHONY: update
update: ## Run streamr-docker-dev update
	streamr-docker-dev update

shell-%: ## Run docker shell. Example: 'make shell-redis'
	streamr-docker-dev shell $*

.PHONY: clean
clean: ## Remove all files created by this Makefile
	rm -rf \
		node_modules \
		lastBlock

.PHONY: help
help: ## Show Help
	@grep -E '^[a-zA-Z_-]+%?:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "%-20s %s\n", $$1, $$2}'|sort
