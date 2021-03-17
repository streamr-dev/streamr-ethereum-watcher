# TODO: always update to latest node LTS (see https://nodejs.org/en/about/releases/)
FROM node:14-alpine
RUN apk update && \
    apk upgrade && \
    apk add --no-cache python git make g++ bash
# Create App Directory
RUN mkdir /app

# Set Workdir
WORKDIR /app

COPY package.json /app
COPY package-lock.json /app
RUN npm ci
COPY . /app
RUN git submodule update --init --recursive

RUN apk add --no-cache python3 && \
    python3 -m ensurepip && \
    rm -r /usr/lib/python*/ensurepip && \
    pip3 install --upgrade pip setuptools && \
    if [ ! -e /usr/bin/pip ]; then ln -s pip3 /usr/bin/pip ; fi && \
    if [[ ! -e /usr/bin/python ]]; then ln -sf /usr/bin/python3 /usr/bin/python; fi && \
    rm -r /root/.cache
RUN pip install awscli --upgrade --user && \
     if [[ ! -e /usr/bin/aws ]]; then ln -sf ~/.local/bin/aws /usr/bin/aws; fi





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