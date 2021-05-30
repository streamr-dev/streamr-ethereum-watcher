import log from "./log"
import {getEnv} from "./env"
import LastBlockStore from "./LastBlockStore"
import StreamrClient from "streamr-client"
import {ethers} from "ethers"
import {throwIfNotContract} from "./checkArguments"
import Watcher from "./watcher"
import Informer from "./informer"
const Marketplace = require("../lib/marketplace-contracts/build/contracts/Marketplace.json")

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

async function getSessionToken(): Promise<string> {
    const client = new StreamrClient({
        auth: {
            privateKey: devopsKey
        }
    })
    return client.session.getSessionToken()
}

async function start() {
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

    const network = provider.getNetwork()
        .then((value: ethers.utils.Network): ethers.utils.Network => {
            return value
        })
        .catch((e: Error): void => {
            log.error(`Connecting to Ethereum failed, ${NETWORK_ID}=${networkId} ${ETHEREUM_SERVER_URL}=${ethereumServerURL}: ${e.message}`)
            process.exit(1)
        })
    log.info("Connected to Ethereum network: " + JSON.stringify(network))

    // deployed using truffle, mainnet tx: https://etherscan.io/tx/0x868a6604e6c33ebc52a3fe5d020d970fdd0019e8eb595232599d67f91624d877
    const deployedMarketplaceAddress = Marketplace.networks[networkId] && Marketplace.networks[networkId].address

    const addr = marketplaceAddress || deployedMarketplaceAddress
    if (!addr) {
        log.error(`Requires ${MARKETPLACE_ADDRESS} or ${NETWORK_ID} one of ` + Object.keys(Marketplace.networks).join(", "))
        process.exit(1)
    }
    const marketAddress = await throwIfNotContract(provider, marketplaceAddress || deployedMarketplaceAddress)

    const market = new ethers.Contract(marketAddress, Marketplace.abi, provider)
    const watcher = new Watcher(provider, Marketplace.abi, market)
    const informer = new Informer(streamrApiURL, getSessionToken)

    watcher.on("error", (...args: any[]): Promise<any> => {
        const e: any = args[0]
        log.error(`Unexpected error on main: ${e}`)
        // if it was because streamr backend couldn't find the product for set(Un)Deployed, just keep chugging
        if (e.code === "ECONNREFUSED") {
            return Promise.resolve()
        }
        return Promise.reject(e)
    })
    watcher.on("productDeployed", (...args: any[]): Promise<any> => {
        const id: string = args[0]
        const body: string = args[1]
        informer.setDeployed(id, body)
        log.info(`Product ${id} deployed ${JSON.stringify(body)}`)
        return Promise.resolve()
    })
    watcher.on("productUndeployed", (...args: any[]): Promise<any> => {
        const id: string = args[0]
        const body: string = args[1]
        informer.setUndeployed(id, body)
        log.info(`Product ${id} UNdeployed ${JSON.stringify(body)}`)
        return Promise.resolve()
    })
    watcher.on("productUpdated", (...args: any[]): Promise<any> => {
        const id: string = args[0]
        const body: any = args[1]
        informer.productUpdated(id, body)
        log.info(`Product ${id} UPDATED ${JSON.stringify(body)}`)
        return Promise.resolve()
    })
    watcher.on("subscribed", (...args: any[]): Promise<any> => {
        const body: any = args[0]
        informer.subscribe(body)
        log.info(`Product ${body.product} subscribed ${JSON.stringify(body)}`)
        return Promise.resolve()
    })
    watcher.on("event", (...args: any[]): Promise<any> => {
        const event: any = args[0]
        log.info(`Watcher detected event: ${JSON.stringify(event)}`)
        return Promise.resolve()
    })
    await watcher.checkMarketplaceAddress()

    // write on disk how many blocks have been processed
    const store = new LastBlockStore(lastBlockDir)
    watcher.on("eventSuccessfullyProcessed", (...args: any[]): Promise<any> => {
        const event: any = args[0]
        store.write(event.blockNumber.toString())
        return Promise.resolve()
    })

    // catch up the blocks that happened when we were gone
    let lastRecorded = store.read()

    let lastActual: number = await provider.getBlockNumber()
    while (lastRecorded < lastActual) {
        log.info(`Playing back blocks ${lastRecorded + 1}...${lastActual} (inclusive)`)
        await watcher.playback(lastRecorded + 1, lastActual)
        store.write(lastActual)
        lastRecorded = lastActual
        lastActual = await provider.getBlockNumber()
    }
    log.info("Playback done. Starting watcher...")

    // report new blocks as they arrive
    await watcher.start()

}

start().catch((e: Error): Promise<void> => {
    log.error(`Unexpected error: ${e.stack}`)
    process.exit(1)
})

log.error("Unexpected restart.")
