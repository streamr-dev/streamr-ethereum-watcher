module.exports = {
  apps : [{
    name   : "watcher-mainnet",
    script : "index.js",
    cwd    : "/home/ubuntu/streamr-ethereum-watcher",
    restart_delay: 5000,
    args   : "--ethereumServerURL=wss://mainnet.infura.io/ws --streamrApiURL=http://localhost:8081/streamr-core/api/v1 --marketplaceAddress=0xf28a73603D577041228f543886f512D350c54d25 --devopsKey=9FA3g-mqSe2BijSni-U2SQETbEWsXLSBO0t_OWLBccPw --verbose"
  }]
}

