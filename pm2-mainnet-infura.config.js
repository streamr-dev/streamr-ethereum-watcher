module.exports = {
    apps : [{
        name   : "watcher-mainnet",
        script : "index.js",
        cwd    : "/home/ubuntu/streamr-ethereum-watcher",
        restart_delay: 5000,
        args   : "--networkId=1 --streamrApiURL=http://localhost:8081/streamr-core/api/v1 --devopsKey=INSERT_DEVOPS_KEY_HERE --verbose=2"
    }]
}

