module.exports = {
  apps : [{
    name   : "watcher-mainnet",
    script : "index.js",
    cwd    : "/home/ubuntu/streamr-ethereum-watcher",
    restart_delay: 5000,
    args   : "--networkId=1 --ethereumServerURL=ws://<ip>:<port> --streamrApiURL=https://www.streamr.com/api/v1 --devopsKey=<key> --verbose=2"
  }]
}