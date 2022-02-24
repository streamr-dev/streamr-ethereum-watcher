# TODO: always update to latest node LTS (see https://nodejs.org/en/about/releases/)
FROM node:16-bullseye AS builder
# Python is required for Npn/Node/Gyp build
RUN apt-get update && apt-get --assume-yes --no-install-recommends install python2=2.7.18-3
WORKDIR /app
COPY package.json /app
COPY package-lock.json /app
RUN npm ci
COPY . /app

# TODO: always update to latest node LTS (see https://nodejs.org/en/about/releases/)
FROM node:16-bullseye-slim
WORKDIR /app
COPY --from=builder /app/ .

# Environment variables for development
ENV DEVOPS_KEY="0x628acb12df34bb30a0b2f95ec2e6a743b386c5d4f63aa9f338bec6f613160e78"
ENV ETHEREUM_SERVER_URL="http://10.200.10.1:8545"
ENV STREAMR_API_URL="http://localhost:8081/streamr-core/api/v2"
ENV NETWORK_ID="8995"
ENV MARKETPLACE_ADDRESS="0xf1371c0f40528406dc4f4caf89924ea9da49e866"
ENV LAST_BLOCK_DIR="."
ENV NODE_ENV="development"
ENV MATIC_SERVER_URL="http://10.200.10.1:8546"
ENV STREAM_REGISTRY_ADDRESS="0x6cCdd5d866ea766f6DF5965aA98DeCCD629ff222"

ENTRYPOINT ["/app/node_modules/.bin/ts-node", "src/main.ts"]
