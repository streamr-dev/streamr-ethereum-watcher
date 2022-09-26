module.exports = {
    apps : [{
        name   : "watcher-gnosis",
        script : "dist/src/main.js",
        cwd    : "/home/ubuntu/streamr-ethereum-watcher",
        interpreter: "/home/ubuntu/.nvm/versions/node/v16.13.2/bin/node",
        restart_delay: 5000,
        env: {
            "ETHEREUM_SERVER_URL": "https://rpc.gnosischain.com",
            "NETWORK_ID": "100",
            "MARKETPLACE_ADDRESS": "0x2022E1F7749D355726Fb65285E29605A098bcb52",
            "LAST_BLOCK_DIR": "/home/ubuntu/streamr-ethereum-watcher/gnosis",
            "NODE_ENV": "production",
            "STREAMR_API_URL": "https://streamr.network/api/v2",
            "MATIC_SERVER_URL": "https://polygon-rpc.com",
            "STREAM_REGISTRY_ADDRESS": "0x0D483E10612F327FC11965Fc82E90dC19b141641",
            "DEVOPS_KEY": "Ethereum key for core-api devops role (watcher)"
        }
    }]
}
