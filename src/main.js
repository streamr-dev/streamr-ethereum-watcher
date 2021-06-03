const log = require("./log")
const {getEnv} = require("./env")
const LastBlockStore = require("./LastBlockStore")
const StreamrClient = require("streamr-client")
const ethers = require("ethers")
const {throwIfNotContract} = require("./checkArguments")
const Watcher = require("./watcher")
const CoreAPIClient = require("./CoreAPIClient")
const Marketplace = require("../lib/marketplace-contracts/build/contracts/Marketplace.json")

async function getSessionToken(privateKey) {
    const client = new StreamrClient({
        auth: {
            privateKey: privateKey,
        }
    })
    return client.session.getSessionToken()
}


/**
 * Check this.market really looks like a Marketplace and not something funny
 */
async function checkMarketplaceAddress(abi, market) {
    const getterNames = abi
        .filter(f => f.constant && f.inputs.length === 0)
        .map(f => f.name)
    let msg = ""
    for (const getterName of getterNames) {
        const value = await market[getterName]()
        msg += ` ${getterName}: ${value},`
    }
    log.info(`Watcher > Checking the Marketplace contract at ${market.address}: ${msg}`)
    return Promise.resolve()
}

async function main() {
    const MARKETPLACE_ADDRESS = "MARKETPLACE_ADDRESS"
    const marketplaceAddress = getEnv(MARKETPLACE_ADDRESS)
    const NETWORK_ID = "NETWORK_ID"
    const networkId = getEnv(NETWORK_ID)
    const ETHEREUM_SERVER_URL = "ETHEREUM_SERVER_URL"
    const ethereumServerURL = getEnv(ETHEREUM_SERVER_URL)
    const STREAMR_API_URL = "STREAMR_API_URL"
    const streamrApiURL = getEnv(STREAMR_API_URL)
    const DEVOPS_KEY = "DEVOPS_KEY"
    const devopsKey = getEnv(DEVOPS_KEY)
    const LAST_BLOCK_DIR = "LAST_BLOCK_DIR"
    const lastBlockDir = getEnv(LAST_BLOCK_DIR)

    try {
        new ethers.Wallet(devopsKey)
    } catch (e) {
        log.error(`Expected a valid Ethereum key for environment variable ${DEVOPS_KEY}="${devopsKey}".`)
        process.exit(1)
    }
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
        log.error(`Requires ${ETHEREUM_SERVER_URL} or ${NETWORK_ID} environment variables!`)
        process.exit(1)
    }

    const network = await provider.getNetwork().catch(e => {
        log.error(`Connecting to Ethereum failed, ${NETWORK_ID}=${networkId} ${ETHEREUM_SERVER_URL}=${ethereumServerURL}: ${e.message}`)
        process.exit(1)
    })
    log.info("Connected to Ethereum network: ", JSON.stringify(network))

    // deployed using truffle, mainnet tx: https://etherscan.io/tx/0x868a6604e6c33ebc52a3fe5d020d970fdd0019e8eb595232599d67f91624d877
    const deployedMarketplaceAddress = Marketplace.networks[networkId] && Marketplace.networks[networkId].address

    const addr = marketplaceAddress || deployedMarketplaceAddress
    if (!addr) {
        log.error(`Requires ${MARKETPLACE_ADDRESS} or ${NETWORK_ID} one of ` + Object.keys(Marketplace.networks).join(", "))
        process.exit(1)
    }
    const marketAddress = await throwIfNotContract(provider, marketplaceAddress || deployedMarketplaceAddress)

    const marketplaceContract = new ethers.Contract(marketAddress, Marketplace.abi, provider)
    const watcher = new Watcher(provider, marketplaceContract)
    const apiClient = new CoreAPIClient(streamrApiURL, getSessionToken, devopsKey)

    await checkMarketplaceAddress(Marketplace.abi, marketplaceContract)

    watcher.on("productDeployed", (id, body) => {
        apiClient.setDeployed(id, body)
        log.info(`Product ${id} deployed ${JSON.stringify(body)}`)
    })
    watcher.on("productUndeployed", (id, body) => {
        apiClient.setUndeployed(id, body)
        log.info(`Product ${id} UNdeployed ${JSON.stringify(body)}`)
    })
    watcher.on("productUpdated", (id, body) => {
        apiClient.productUpdated(id, body)
        log.info(`Product ${id} UPDATED ${JSON.stringify(body)}`)
    })
    watcher.on("subscribed", (body) => {
        apiClient.subscribe(body)
        log.info(`Product ${body.product} subscribed ${JSON.stringify(body)}`)
    })
    watcher.on("event", event => {
        log.info(`Watcher detected event: ${JSON.stringify(event)}`)
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
            log.error(`Unexpected error on main: ${e}`)
            // if it was because streamr backend couldn't find the product for set(Un)Deployed, just keep chugging
            if (e.code === "ECONNREFUSED") {
                return
            }

            fail(e)
        })
    })
}

main().catch(e => {
    log.error(`Unexpected error: ${e.stack}`)
    process.exit(1)
})

log.error("Unexpected restart.")
