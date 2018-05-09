module.exports = {
  apps : [{
    name   : "watcher-mainnet",
    script : "index.js",
    cwd    : "/home/ubuntu/streamr-ethereum-watcher",
    restart_delay: 5000,
    args   : "--networkId=1 --ethereumServerURL=ws://94.130.70.249:8557 --streamrApiURL=https://www.streamr.com/api/v1 --devopsKey=9FA3g-mqSe2BijSni-U2SQETbEWsXLSBO0t_OWLBccPw --verbose=2"
  }]
}

