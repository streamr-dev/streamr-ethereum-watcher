const log = require("./src/log")
// for persisting last processed block (to avoid full playback every restart)
const fs = require("fs")
const StreamrClient = require("streamr-client")
const ethers = require("ethers")
const argv = require("yargs").argv
const { throwIfNotContract } = require("./src/checkArguments")
const Watcher = require("./src/watcher")
const Informer = require("./src/informer")

const {
    old,
    marketplaceAddress,
    networkId,
    ethereumServerURL,
    streamrApiURL,
    devopsKey,
    verbose,
    logDir = "logs"     // also where the persisted program state (lastBlock) lives
} = argv

// TODO: Is old marketplace still needed?
// TODO: Remove old argument
// TODO: Move following statement to top where all other requires are
const Marketplace = old ?
    require("./lib/marketplace-contracts/build/contracts/OldMarketplace.json") :
    require("./lib/marketplace-contracts/build/contracts/Marketplace.json")

try {
    new ethers.Wallet(devopsKey)
} catch (e) {
    log.error(`Bad --devopsKey argument "${devopsKey}", expected a valid Ethereum key`)
    process.exit(1)
}

async function getSessionToken() {
    const client = new StreamrClient({
        auth: {
            privateKey: devopsKey
        }
    })
    return client.session.getSessionToken()
}

async function start() {
    let provider = null
    if (networkId) {
        if (ethereumServerURL) {
            provider = new ethers.providers.JsonRpcProvider(ethereumServerURL)
        } else {
            provider = ethers.getDefaultProvider(networkId)
        }
    } else if (ethereumServerURL) {
        provider = new ethers.providers.JsonRpcProvider(ethereumServerURL)
    }
    if (!provider) { throw new Error("missing --ethereumServerURL or --networkId!") }

    const network = await provider.getNetwork().catch(e => {
        throw new Error(`Connecting to Ethereum failed, --networkId=${networkId} --ethereumServerURL=${ethereumServerURL}: ${e.message}`)
    })
    log.info("Connected to Ethereum network: ", JSON.stringify(network))

    // deployed using truffle, mainnet tx: https://etherscan.io/tx/0x868a6604e6c33ebc52a3fe5d020d970fdd0019e8eb595232599d67f91624d877
    const deployedMarketplaceAddress = Marketplace.networks[networkId] && Marketplace.networks[networkId].address

    const addr = marketplaceAddress || deployedMarketplaceAddress
    if (!addr) { throw new Error("Requires --marketplaceAddress or --networkId one of " + Object.keys(Marketplace.networks).join(", ")) }
    const marketAddress = await throwIfNotContract(provider, marketplaceAddress || deployedMarketplaceAddress)

    const watcher = new Watcher(provider, marketAddress, old)

    const informer = new Informer(streamrApiURL, getSessionToken)

    if (verbose) {
        watcher.on("productDeployed", (id, body) => { log.info(`Product ${id} deployed ${JSON.stringify(body)}`) })
        watcher.on("productUndeployed", (id, body) => { log.info(`Product ${id} UNdeployed ${JSON.stringify(body)}`) })
        watcher.on("productUpdated", (id, body) => { log.info(`Product ${id} UPDATED ${JSON.stringify(body)}`) })
        watcher.on("subscribed", (body) => { log.info(`Product ${body.product} subscribed ${JSON.stringify(body)}`) })
        if (verbose > 1) {
            watcher.logger = (...args) => { log.info(" Watcher >", ...args) }
            informer.logger = (...args) => { log.info(" watcher/Informer >", ...args) }
            watcher.on("event", event => {
                log.info(`    Watcher detected event: ${JSON.stringify(event)}`)
            })
        }
    }
    await watcher.checkMarketplaceAddress()

    // set up reporting
    watcher.on("productDeployed", informer.setDeployed.bind(informer))
    watcher.on("productUndeployed", informer.setUndeployed.bind(informer))
    watcher.on("productUpdated", informer.productUpdated.bind(informer))
    watcher.on("subscribed", informer.subscribe.bind(informer))

    watcher.on("event", event => {
        log.info(`event: ${event.event}`)
    })

    // write on disk how many blocks have been processed
    const lastBlockPath = logDir + "/lastBlock"
    watcher.on("eventSuccessfullyProcessed", event => {
        fs.writeFile(lastBlockPath, event.blockNumber.toString(), err => {
            if (err) { throw err }
            if (verbose > 2) {
                log.info(`Processed https://etherscan.io/block/${event.blockNumber}. Wrote ${lastBlockPath}.`)
            }
        })
    })

    // catch up the blocks that happened when we were gone
    let lastRecorded = 0
    try {
        const buffer = fs.readFileSync(lastBlockPath)
        lastRecorded = parseInt(buffer.toString())
    } catch (e) {
        log.error(`error while reading last block: ${e.message}`)
        // ignore error; if file is missing, start from zero
    }

    let lastActual = await provider.getBlockNumber()
    while (lastRecorded < lastActual) {
        log.info(`Playing back blocks ${lastRecorded + 1}...${lastActual} (inclusive)`)
        await watcher.playback(lastRecorded + 1, lastActual)
        fs.writeFileSync(lastBlockPath, lastActual.toString())
        lastRecorded = lastActual
        lastActual = await provider.getBlockNumber()
    }
    log.info("Playback done")

    // report new blocks as they arrive
    log.info("Starting watcher...")
    await watcher.start()

    return new Promise((done, fail) => {
        watcher.on("error", e => {
            // if it was because streamr backend couldn't find the product for set(Un)Deployed, just keep chugging
            if (e.code === "ECONNREFUSED") { return }

            fail(e)
        })
    })
}

start().catch(e => {
    log.error(e.stack)
    process.exit(1)
})

log.error("Restart")
