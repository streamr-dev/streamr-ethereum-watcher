#!/usr/bin/env bash
## Script for preparing smoke test
sudo ifconfig docker0 10.200.10.1/24

## Get Streamr Docker dev
git clone https://github.com/streamr-dev/streamr-docker-dev.git

## Switch out image for local one
sed -i "s#$OWNER/$IMAGE_NAME:dev#$OWNER/$IMAGE_NAME\:local#g" $TRAVIS_BUILD_DIR/streamr-docker-dev/docker-compose.override.yml

## Start up stack
$TRAVIS_BUILD_DIR/streamr-docker-dev/streamr-docker-dev/bin.sh start --wait

## Wait for the service to come online and test
wait_time=10;
for (( i=0; i < 5; i=i+1 )); do
    docker logs streamr-dev-ethereum-watcher > out.txt
    grep -q "Starting watcher for" out.txt
    res=$?;
    if test "$res" != "0"; then
        echo "Attempting to connect to Ethereum-Watcher retrying in $wait_time seconds";
        sleep $wait_time;
        wait_time=$(( 2*wait_time )) ;
    else
       break;
    fi;
done;
set -e
grep -q "Starting watcher for" out.txt
