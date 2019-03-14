[![Build Status](https://travis-ci.com/streamr-dev/streamr-ethereum-watcher.svg?token=9unddqKugX2cPcyhtVxp&branch=master)](https://travis-ci.com/streamr-dev/streamr-ethereum-watcher)

# Marketplace Watcher
An optional service of the Streamr cloud architecture that listens to events emitted by the Streamr Marketplace smart
contract and informs [Engine-and-Editor](https://github.com/streamr-dev/engine-and-editor) of changes to products.

For redundancy, run multiple instances in parallel attached to different Ethereum nodes.

## Building
Project uses npm for package management.

- Start off by installing required dependencies with `npm install`
- To run tests `npm test`

## Running
In most cases, you will want to run this service as a [pre-built Docker image](https://hub.docker.com/r/streamr/ethereum-watcher/).
See https://github.com/streamr-dev/streamr-docker-dev for more information on how to run the Streamr cloud architecture.

If you are developing this service in particular, or are otherwise inclined, you can run this service with `npm start`.

## Publishing
The project is automatically tested and built using Travis CI. If and when all tests pass, a [Docker image](https://hub.docker.com/r/streamr/data-api/) is built and pushed to DockerHub by Travis CI.

## License

This software is open source, and dual licensed under [AGPLv3](https://www.gnu.org/licenses/agpl.html) and an enterprise-friendly commercial license.
