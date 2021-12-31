# TODO: always update to latest node LTS (see https://nodejs.org/en/about/releases/)
FROM node:14-bullseye AS builder
RUN mkdir /app
WORKDIR /app
COPY package.json /app
COPY package-lock.json /app
RUN npm ci
COPY . /app

# TODO: always update to latest node LTS (see https://nodejs.org/en/about/releases/)
FROM node:14-bullseye-slim
WORKDIR /app
COPY --from=builder /app/ .

# Environment variables for development
ENV DEVOPS_KEY="0x628acb12df34bb30a0b2f95ec2e6a743b386c5d4f63aa9f338bec6f613160e78"
ENV ETHEREUM_SERVER_URL="http://10.200.10.1:8545"
ENV STREAMR_API_URL="http://localhost:8081/streamr-core/api/v1"
ENV NETWORK_ID="8995"
ENV MARKETPLACE_ADDRESS="0xf1371c0f40528406dc4f4caf89924ea9da49e866"
ENV LAST_BLOCK_DIR="."
ENV NODE_ENV="development"

ENTRYPOINT ["/app/node_modules/.bin/ts-node", "src/main.ts"]
