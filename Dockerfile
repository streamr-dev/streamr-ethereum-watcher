# Use official Node 9 Image as base image
FROM node:8-alpine
RUN apk update && \
    apk upgrade && \
    apk add --no-cache python git make g++ bash
# Create App Directory
RUN mkdir /app

# Set Workdir
WORKDIR /app

COPY package.json /app
COPY package-lock.json /app
RUN npm install
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
ENV METRICS true
ENV NETWORK_ID 5

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
    --metrics=${METRICS}