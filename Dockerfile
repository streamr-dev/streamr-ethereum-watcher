# Use official Node 9 Image as base image
FROM node:9.11.1-alpine

RUN apk update
RUN apk add --no-cache \
            libstdc++  \
            git \
            bash \
            && apk add --no-cache --virtual .build-deps \
                binutils-gold \
                curl \
                g++ \
                gcc \
                gnupg \
                libgcc \
                linux-headers \
                make \
                python
# Create App Directory
RUN mkdir /app

# Set Workdir
WORKDIR /app

COPY package.json /app
COPY package-lock.json /app
RUN npm install
COPY . /app
RUN git submodule update --init --recursive

ENTRYPOINT ["node"]
CMD ["index.js", "--streamrApiURL='http://localhost:8081/streamr-core/api/v1'", "--devopsKey='devops-user-key'","--ethereumServerURL='wss://rinkeby.infura.io/ws'", "--marketplaceAddress='0x1994925b5da03929f8f51cf3891aee199656ec72'","--verbose=1"]
