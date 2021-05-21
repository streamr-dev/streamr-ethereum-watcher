# TODO: always update to latest node LTS (see https://nodejs.org/en/about/releases/)
FROM node:14-buster AS builder
RUN mkdir /app
WORKDIR /app
COPY package.json /app
COPY package-lock.json /app
RUN npm ci
COPY . /app

# TODO: always update to latest node LTS (see https://nodejs.org/en/about/releases/)
FROM node:14-buster-slim
RUN apt-get update && apt-get --assume-yes --no-install-recommends install awscli
WORKDIR /app
COPY --from=builder /app/ .

# Default environment variables
# App Variables
ENV STREAMR_API_URL http://localhost:8081/streamr-core/api/v1
# core-api devops account private key in test db
ENV DEVOPS_KEY 0x628acb12df34bb30a0b2f95ec2e6a743b386c5d4f63aa9f338bec6f613160e78
ENV METRICS false
ENV NETWORK_ID rinkeby
ENV MARKETPLACE_ADDRESS 0xf1371c0f40528406dc4f4caf89924ea9da49e866
ENV ETHEREUM_SERVER_URL http://10.200.10.1:8545

# Secret Variables
ENV REMOTE_SECRETS false
ENV BUCKET_NAME default_bucket
ENV APP_NAME default_app

ENTRYPOINT ["sh","docker-entrypoint.sh"]

CMD node index.js \
    --streamrApiURL=${STREAMR_API_URL} \
    --devopsKey=${DEVOPS_KEY} \
    --networkId=${NETWORK_ID} \
    --ethereumServerURL=${ETHEREUM_SERVER_URL} \
    --verbose=2 \
    --metrics=${METRICS} \
    --marketplaceAddress=${MARKETPLACE_ADDRESS}
