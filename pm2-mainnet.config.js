module.exports = {
    apps : [{
        name   : "watcher-mainnet",
        script : "index.js",
        cwd    : "/home/ubuntu/streamr-ethereum-watcher",
        restart_delay: 5000,
        args   : "--devopsKey=INSERT_DEVOPS_KEY_HERE --networkId=1 --ethereumServerURL=INSERT_INFURA_URL_HERE --streamrApiURL=https://streamr.network/api/v1 --verbose=2"
    }]
}
