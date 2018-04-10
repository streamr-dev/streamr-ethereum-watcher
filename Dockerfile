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

ENTRYPOINT ["node"]
CMD ["index.js", "--streamrApiURL='http://localhost:8081/streamr-core/api/v1'", "--devopsKey='devops-user-key'","--ethereumServerURL='wss://rinkeby.infura.io/ws'", "--marketplaceAddress='0x1994925b5da03929f8f51cf3891aee199656ec72'","--verbose=1"]
