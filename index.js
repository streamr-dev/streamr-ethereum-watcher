const log = require("./src/log")
// for persisting last processed block (to avoid full playback every restart)
const fs = require("fs")
const StreamrClient = require("streamr-client")
const ethers = require("ethers")
const yargs = require("yargs/yargs")
const { hideBin } = require("yargs/helpers")
const { throwIfNotContract } = require("./src/checkArguments")
const Watcher = require("./src/watcher")
const Informer = require("./src/informer")
const Marketplace = require("./lib/marketplace-contracts/build/contracts/Marketplace.json")

const args = yargs(hideBin(process.argv))
    .option("marketplaceAddress", {
        string: true,
    })
    .option("networkId", {
        number: true,
    })
    .option("ethereumServerURL", {
        string: true,
    })
    .option("streamrApiURL", {
        string: true,
    })
    .option("devopsKey", {
        string: true,
    })
    .option("verbose", {
        number: true,
    })
    .option("logDir", {
        string: true,
        default: "logs", // also where the persisted program state (lastBlock) lives
    })
    .argv

try {
    new ethers.Wallet(args.devopsKey)
} catch (e) {
    log.error(`Bad --devopsKey argument "${args.devopsKey}", expected a valid Ethereum key`)
    process.exit(1)
}

async function getSessionToken() {
    const client = new StreamrClient({
        auth: {
            privateKey: args.devopsKey
        }
    })
    return client.session.getSessionToken()
}

async function start() {
    let provider = null
    if (args.networkId) {
        if (args.ethereumServerURL) {
            provider = new ethers.providers.JsonRpcProvider(args.ethereumServerURL)
        } else {
            provider = ethers.getDefaultProvider(args.networkId)
        }
    } else if (args.ethereumServerURL) {
        provider = new ethers.providers.JsonRpcProvider(args.ethereumServerURL)
    }
    if (!provider) { throw new Error("missing --ethereumServerURL or --networkId!") }

    const network = await provider.getNetwork().catch(e => {
        throw new Error(`Connecting to Ethereum failed, --networkId=${args.networkId} --ethereumServerURL=${args.ethereumServerURL}: ${e.message}`)
    })
    log.info("Connected to Ethereum network: ", JSON.stringify(network))

    // deployed using truffle, mainnet tx: https://etherscan.io/tx/0x868a6604e6c33ebc52a3fe5d020d970fdd0019e8eb595232599d67f91624d877
    const deployedMarketplaceAddress = Marketplace.networks[args.networkId] && Marketplace.networks[args.networkId].address

    const addr = args.marketplaceAddress || deployedMarketplaceAddress
    if (!addr) { throw new Error("Requires --marketplaceAddress or --networkId one of " + Object.keys(Marketplace.networks).join(", ")) }
    const marketAddress = await throwIfNotContract(provider, args.marketplaceAddress || deployedMarketplaceAddress)

    const watcher = new Watcher(provider, marketAddress)

    const informer = new Informer(args.streamrApiURL, getSessionToken)

    if (args.verbose) {
        watcher.on("productDeployed", (id, body) => { log.info(`Product ${id} deployed ${JSON.stringify(body)}`) })
        watcher.on("productUndeployed", (id, body) => { log.info(`Product ${id} UNdeployed ${JSON.stringify(body)}`) })
        watcher.on("productUpdated", (id, body) => { log.info(`Product ${id} UPDATED ${JSON.stringify(body)}`) })
        watcher.on("subscribed", (body) => { log.info(`Product ${body.product} subscribed ${JSON.stringify(body)}`) })
        if (args.verbose > 1) {
            watcher.logger = (...msgs) => { log.info(" Watcher >", ...msgs) }
            informer.logger = (...msgs) => { log.info(" watcher/Informer >", ...msgs) }
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
    const lastBlockPath = args.logDir + "/lastBlock"
    watcher.on("eventSuccessfullyProcessed", event => {
        fs.writeFile(lastBlockPath, event.blockNumber.toString(), err => {
            if (err) { throw err }
            if (args.verbose > 2) {
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
