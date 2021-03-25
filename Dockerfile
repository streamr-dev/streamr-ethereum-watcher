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
RUN apt-get update && apt-get --assume-yes --no-install-recommends install \
	python \
	python-pip \
	&& pip install awscli
WORKDIR /app
COPY --from=builder /app/ .

# Default environment variables
# App Variables
ENV STREAMR_API_URL http://localhost:8081/streamr-core/api/v1
ENV DEVOPS_KEY devops-user-key
ENV METRICS false
ENV NETWORK_ID rinkeby
ENV MARKETPLACE_ADDRESS 0xA10151D088f6f2705a05d6c83719e99E079A61C1

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
