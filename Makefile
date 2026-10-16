.DEFAULT_GOAL := help

BUN ?= bun
PYTHON ?= python3
DOCKER ?= docker
DOCKER_ENV_FILE ?= .env.production
PRODUCTION_ENV_FILE ?= .env.production
DEVELOPMENT_ENV_FILE ?= .env.development
RELEASE_DIR ?= release

.PHONY: help serena start build-extensions build-chrome build-firefox package-extensions package-chrome package-firefox docker-build

help: ## Show available shortcuts
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z_-]+:.*## / {printf "  %-22s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

serena:
	uvx --from git+https://github.com/oraios/serena serena start-mcp-server --transport streamable-http --port 9121 --project-from-cwd --context codex

start:
	$(BUN) --env-file="$(DEVELOPMENT_ENV_FILE)" run dev

build-extensions: ## Build production extensions for Chrome and Firefox
	$(BUN) --env-file="$(PRODUCTION_ENV_FILE)" run build:extensions

build-chrome: ## Build the production Chrome extension
	$(BUN) --env-file="$(PRODUCTION_ENV_FILE)" run build:extension:chrome

build-firefox: ## Build the production Firefox extension
	$(BUN) --env-file="$(PRODUCTION_ENV_FILE)" run build:extension:firefox

package-extensions: build-extensions ## Build both extensions and create store upload ZIPs
	$(PYTHON) scripts/package-extensions.py --output-dir "$(RELEASE_DIR)"

package-chrome: build-chrome ## Build Chrome and create its store upload ZIP
	$(PYTHON) scripts/package-extensions.py chrome --output-dir "$(RELEASE_DIR)"

package-firefox: build-firefox ## Build Firefox and create its store upload ZIP
	$(PYTHON) scripts/package-extensions.py firefox --output-dir "$(RELEASE_DIR)"

docker-build: ## Build the deployment image using .env.docker (override DOCKER_ENV_FILE)
	$(DOCKER) compose --env-file "$(DOCKER_ENV_FILE)" build --pull app
