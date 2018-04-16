const fs = require("mz/fs")
const argv = require("yargs").argv

const {
    marketplaceAddress,
    ethereumServerURL,
    streamrApiURL,
    devopsKey,
    verbose,
    logDir = "logs"
} = argv

const Web3 = require("web3")
const web3 = new Web3(ethereumServerURL)

const Watcher = require("./src/watcher")
const watcher = new Watcher(web3, marketplaceAddress)

const Informer = require("./src/informer")
const informer = new Informer(streamrApiURL, devopsKey)

if (verbose) {
    watcher.on("productDeployed", (id, body) => { console.log(`Product ${id} deployed ${JSON.stringify(body)}`) })
    watcher.on("productUndeployed", (id, body) => { console.log(`Product ${id} UNdeployed ${JSON.stringify(body)}`) })
    watcher.on("productUpdated", (id, body) => { console.log(`Product ${id} UPDATED ${JSON.stringify(body)}`) })
    watcher.on("subscribed", (body) => { console.log(`Product ${body.product} subscribed ${JSON.stringify(body)}`) })
    if (verbose > 1) {
        watcher.logger = console.log
        informer.logging = true
    }
}

async function start() {
    // set up reporting
    watcher.on("productDeployed", informer.setDeployed.bind(informer))
    watcher.on("productUndeployed", informer.setUndeployed.bind(informer))
    watcher.on("productUpdated", informer.productUpdated.bind(informer))
    watcher.on("subscribed", informer.subscribe.bind(informer))

    // catch up the blocks that happened when we were gone
    let lastRecorded = parseInt(await fs.readFile(logDir + "/lastBlock"))
    let lastActual = await web3.eth.getBlockNumber()
    while (lastRecorded < lastActual) {
        console.log(`Playing back blocks ${lastRecorded+1}...${lastActual} (inclusive)`)
        await watcher.playback(lastRecorded + 1, lastActual)
        await fs.writeFile(logDir + "/lastBlock", lastActual)
        lastRecorded = lastActual
        lastActual = await web3.eth.getBlockNumber()
    }

    // report new blocks as they arrive
    console.log("Starting watcher...")
    watcher.start()

    watcher.on("eventSuccessfullyProcessed", event => {
        fs.writeFile(logDir + "/lastBlock", event.blockNumber)
            .then(() => {
                if (verbose) {
                    console.log(`Processed https://rinkeby.etherscan.io/block/${event.blockNumber}. Wrote ${logDir}/lastBlock.`)
                }
            })
    })

    return new Promise((done, fail) => {
        watcher.on("error", fail)
    })

    return "Watcher started."
}
start().then(console.log).catch(e => {
    console.error(e);
    process.exit(1)
})
