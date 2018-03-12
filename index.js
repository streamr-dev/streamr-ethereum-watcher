const fs = require("mz/fs")
const argv = require("yargs").argv

const {
    marketplaceAddress,
    ethereumServerURL,
    streamrEngineURL,
    devopsKey,
    logDir = "logs"
} = argv

const Web3 = require("web3")
const web3 = new Web3(ethereumServerURL)

const Watcher = require("./src/watcher")
const watcher = new Watcher(web3, marketplaceAddress)

const Informer = require("./src/informer")
const informer = new Informer(streamrEngineURL, devopsKey)

async function start() {
    // set up reporting
    watcher.on("productDeployed", informer.setDeployed)
    watcher.on("productUndeployed", informer.setUndeployed)

    // catch up the blocks that happened when we were gone
    let lastRecorded = await fs.readFile(logDir + "/lastBlock")
    let lastActual = await web3.getBlockNumber()
    while (lastRecorded < lastActual) {
        log.debug(`Playing back blocks ${lastRecorded+1}...${lastActual} (inclusive)`)
        await watcher.playback(lastRecorded + 1, lastActual)
        lastRecorded = lastActual
        lastActual = await web3.getBlockNumber()
    }

    // report new blocks as they arrive
    log.debug("Starting watcher...")
    watcher.start()

    return "Done"
}
start().then(console.log)
