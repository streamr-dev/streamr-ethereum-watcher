[![CI & CD](https://github.com/streamr-dev/streamr-ethereum-watcher/actions/workflows/ci-cd.yaml/badge.svg)](https://github.com/streamr-dev/streamr-ethereum-watcher/actions/workflows/ci-cd.yaml)

# Marketplace Watcher
Service of the Streamr Network that listens to events emitted by the Streamr Marketplace smart
contract and informs [Core API](https://github.com/streamr-dev/core-api) of changes to products.

For redundancy, run multiple instances in parallel attached to different Ethereum nodes.

## Building
Project uses npm for package management.

- Start off by selecting correct Node and Npm version `nvm use`
- Install required dependencies with `make node_modules`
- To run tests `make test`
- To run ethereum-watcher locally `make run`
- To build local Docker image, start Streamr Docker stack and to see logs run `make docker-build start log`

## Running
In most cases, you will want to run this service as a [pre-built Docker image](https://hub.docker.com/r/streamr/ethereum-watcher/).
See https://github.com/streamr-dev/streamr-docker-dev for more information on how to run the Streamr stack.

If you are developing this service in particular, or are otherwise inclined, you can run this service with `make run`.

## Publishing
The project is automatically tested and built using GitHub Actions. If and when all tests pass, a [Docker image](https://hub.docker.com/r/streamr/ethereum-watcher/) is built and pushed to DockerHub by GitHub Actions.

## Updating Corea Production

Run
```
cd ~/streamr-ethereum-watcher
git pull
nvm use
npm ci
```
If Systemd service files are updated run: `systemctl daemon-reload`

Restart services:
```
systemctl restart ethereum-watcher-mainnet.service
systemctl restart ethereum-watcher-pocket.service
```

## License

This software is open source, and dual licensed under [AGPLv3](https://www.gnu.org/licenses/agpl.html) and an enterprise-friendly commercial license.
