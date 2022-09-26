module.exports = {
    apps : [{
        name   : "watcher-polygon",
        script : "dist/src/main.js",
        cwd    : "/home/ubuntu/streamr-ethereum-watcher",
        interpreter: "/home/ubuntu/.nvm/versions/node/v16.13.2/bin/node",
        restart_delay: 5000,
        env: {
            "ETHEREUM_SERVER_URL": "https://polygon-rpc.com",
            "NETWORK_ID": "137",
            "MARKETPLACE_ADDRESS": "0x1e9c22B4C92ce78Fe489C72f9D070C583D8359C3",
            "LAST_BLOCK_DIR": "/home/ubuntu/streamr-ethereum-watcher/polygon",
            "NODE_ENV": "production",
            "STREAMR_API_URL": "https://streamr.network/api/v2",
            "MATIC_SERVER_URL": "https://polygon-rpc.com",
            "STREAM_REGISTRY_ADDRESS": "0x0D483E10612F327FC11965Fc82E90dC19b141641",
            "DEVOPS_KEY": "Ethereum key for core-api devops role (watcher)"
        }
    }]
}
