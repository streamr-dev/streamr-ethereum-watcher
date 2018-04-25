# Use official Node 9 Image as base image
FROM ubuntu:16.04

RUN apt-get update
RUN apt-get install -yq curl
RUN curl -sL https://deb.nodesource.com/setup_8.x -o nodesource_setup.sh
RUN bash nodesource_setup.sh
RUN apt-get install -yq \
            git \
            bash \
            nodejs \
            binutils-gold \
            curl \
            g++ \
            gcc \
            gnupg \
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
RUN apt-get clean

# Default environment variables
ENV STREAMR_API_URL http://localhost:8081/streamr-core/api/v1
ENV DEVOPS_KEY devops-user-key
#ENV ETHEREUM_SERVER_URL wss://rinkeby.infura.io/ws
#ENV MARKETPLACE_ADDRESS 0xDA07b416867Ef8ee0F36e6870C76ffaf472d124C

CMD node index.js \
    --streamrApiURL=${STREAMR_API_URL} \
    --devopsKey=${DEVOPS_KEY} \
    --networkId=4 \
    --verbose=1
#    --ethereumServerURL=${ETHEREUM_SERVER_URL}
#    --marketplaceAddress=${MARKETPLACE_ADDRESS}