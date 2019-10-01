module.exports = {
    apps : [{
        name   : "watcher-mainnet",
        script : "index.js",
        cwd    : "/home/ubuntu/streamr-ethereum-watcher",
        restart_delay: 5000,
        args   : "--devopsKey=INSERT_DEVOPS_KEY_HERE --networkId=homestead --streamrApiURL=https://www.streamr.com/api/v1 --verbose=2"
    }]
}

