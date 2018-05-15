# Use official Node 9 Image as base image
FROM node:9.11.1-alpine
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


# Default environment variables
ENV STREAMR_API_URL http://localhost:8081/streamr-core/api/v1
ENV DEVOPS_KEY devops-user-key
ENV METRICS true

CMD node index.js \
    --streamrApiURL=${STREAMR_API_URL} \
    --devopsKey=${DEVOPS_KEY} \
    --networkId=4 \
    --verbose=2 \
    --metrics=${METRICS}