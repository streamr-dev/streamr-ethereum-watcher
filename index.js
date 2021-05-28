const log = require("./src/log")
const {getEnv} = require("./src/env")
const LastBlockStore = require("./src/LastBlockStore")
const StreamrClient = require("streamr-client")
const ethers = require("ethers")
const {throwIfNotContract} = require("./src/checkArguments")
const Watcher = require("./src/watcher")
const Informer = require("./src/informer")
const Marketplace = require("./lib/marketplace-contracts/build/contracts/Marketplace.json")

const marketplaceAddress = getEnv("MARKETPLACE_ADDRESS")
const networkId = getEnv("NETWORK_ID")
const ethereumServerURL = getEnv("ETHEREUM_SERVER_URL")
const streamrApiURL = getEnv("STREAMR_API_URL")
const devopsKey = getEnv("DEVOPS_KEY")
const lastBlockDir = getEnv("LAST_BLOCK_DIR")

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
    if (!provider) {
        throw new Error("missing --ethereumServerURL or --networkId!")
    }

    const network = await provider.getNetwork().catch(e => {
        throw new Error(`Connecting to Ethereum failed, --networkId=${networkId} --ethereumServerURL=${ethereumServerURL}: ${e.message}`)
    })
    log.info("Connected to Ethereum network: ", JSON.stringify(network))

    // deployed using truffle, mainnet tx: https://etherscan.io/tx/0x868a6604e6c33ebc52a3fe5d020d970fdd0019e8eb595232599d67f91624d877
    const deployedMarketplaceAddress = Marketplace.networks[networkId] && Marketplace.networks[networkId].address

    const addr = marketplaceAddress || deployedMarketplaceAddress
    if (!addr) {
        throw new Error("Requires --marketplaceAddress or --networkId one of " + Object.keys(Marketplace.networks).join(", "))
    }
    const marketAddress = await throwIfNotContract(provider, marketplaceAddress || deployedMarketplaceAddress)

    const watcher = new Watcher(provider, marketAddress)
    const informer = new Informer(streamrApiURL, getSessionToken)

    watcher.on("productDeployed", (id, body) => {
        log.info(`Product ${id} deployed ${JSON.stringify(body)}`)
    })
    watcher.on("productUndeployed", (id, body) => {
        log.info(`Product ${id} UNdeployed ${JSON.stringify(body)}`)
    })
    watcher.on("productUpdated", (id, body) => {
        log.info(`Product ${id} UPDATED ${JSON.stringify(body)}`)
    })
    watcher.on("subscribed", (body) => {
        log.info(`Product ${body.product} subscribed ${JSON.stringify(body)}`)
    })
    watcher.on("event", event => {
        log.info(`    Watcher detected event: ${JSON.stringify(event)}`)
    })
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
    const store = new LastBlockStore(lastBlockDir)
    watcher.on("eventSuccessfullyProcessed", event => {
        store.write(event.blockNumber.toString())
    })

    // catch up the blocks that happened when we were gone
    let lastRecorded = store.read()

    let lastActual = await provider.getBlockNumber()
    while (lastRecorded < lastActual) {
        log.info(`Playing back blocks ${lastRecorded + 1}...${lastActual} (inclusive)`)
        await watcher.playback(lastRecorded + 1, lastActual)
        store.write(lastActual.toString())
        lastRecorded = lastActual
        lastActual = await provider.getBlockNumber()
    }
    log.info("Playback done. Starting watcher...")

    // report new blocks as they arrive
    await watcher.start()

    return new Promise((done, fail) => {
        watcher.on("error", e => {
            // if it was because streamr backend couldn't find the product for set(Un)Deployed, just keep chugging
            if (e.code === "ECONNREFUSED") {
                return
            }

            fail(e)
        })
    })
}

start().catch(e => {
    log.error(e.stack)
    process.exit(1)
})

log.error("Restart")
