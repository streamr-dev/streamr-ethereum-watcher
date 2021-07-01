import log from "./log"
import {getEnv} from "./env"
import LastBlockStore from "./LastBlockStore"
import {ethers} from "ethers"
import {throwIfNotContract} from "./checkArguments"
import Watcher from "./watcher"
import CoreAPIClient from "./CoreAPIClient"
import MarketplaceJSON from "../lib/marketplace-contracts/build/contracts/Marketplace.json"

/**
 * Check this.market really looks like a Marketplace and not something funny
 */
async function checkMarketplaceAddress(abi: any, market: ethers.Contract): Promise<void> {
    const getterNames: string = abi
        .filter((f: any) => f.constant && f.inputs.length === 0)
        .map((f: any) => f.name)
    let msg = ""
    for (const getterName of getterNames) {
        const value = await market[getterName]()
        msg += ` ${getterName}: ${value},`
    }
    log.info(`Watcher > Checking the Marketplace contract at ${market.address}: ${msg}`)
    return Promise.resolve()
}

async function main(): Promise<void> {
    const MARKETPLACE_ADDRESS = "MARKETPLACE_ADDRESS"
    const marketplaceAddress: string = getEnv(MARKETPLACE_ADDRESS)
    const NETWORK_ID = "NETWORK_ID"
    const networkId: string = getEnv(NETWORK_ID)
    const ETHEREUM_SERVER_URL = "ETHEREUM_SERVER_URL"
    const ethereumServerURL: string = getEnv(ETHEREUM_SERVER_URL)
    const STREAMR_API_URL = "STREAMR_API_URL"
    const streamrApiURL: string = getEnv(STREAMR_API_URL)
    const DEVOPS_KEY = "DEVOPS_KEY"
    const devopsKey: string = getEnv(DEVOPS_KEY)
    const LAST_BLOCK_DIR = "LAST_BLOCK_DIR"
    const lastBlockDir: string = getEnv(LAST_BLOCK_DIR)

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
    const deployedMarketplaceAddress = "0x2b3F2887c697B3f4f8D9F818c95482e1a3A759A5"

    const addr = marketplaceAddress || deployedMarketplaceAddress
    if (!addr) {
        log.error(`Requires ${MARKETPLACE_ADDRESS} or ${NETWORK_ID} one of ` + Object.keys(MarketplaceJSON.networks).join(", "))
        process.exit(1)
    }
    const marketAddress = await throwIfNotContract(provider, marketplaceAddress || deployedMarketplaceAddress)

    const marketplaceContract = new ethers.Contract(marketAddress, MarketplaceJSON.abi, provider)
    const watcher = new Watcher(provider, marketplaceContract)
    const apiClient = new CoreAPIClient(
        streamrApiURL,
        CoreAPIClient.DEFAULT_FETCH_FUNC,
        CoreAPIClient.DEFAULT_GET_SESSION_TOKEN_FUNC,
        devopsKey,
    )

    await checkMarketplaceAddress(MarketplaceJSON.abi, marketplaceContract)

    await watcher.on("productDeployed", async (...args: any[]): Promise<any> => {
        const id = args[0]
        const body = args[1]
        const response = await apiClient.setDeployed(id, body)
        const responseJson = await response.json()
        log.info(`Product ${id} deployed ${JSON.stringify(body)}`)
        log.info(`Response code ${response.status}: ${JSON.stringify(responseJson)}`)
        return Promise.resolve()
    })
    await watcher.on("productUndeployed", async (...args: any[]): Promise<any> => {
        const id = args[0]
        const body = args[1]
        const response = await apiClient.setUndeployed(id, body)
        const responseJson = await response.json()
        log.info(`Product ${id} UNdeployed ${JSON.stringify(body)}`)
        log.info(`Response code ${response.status}: ${JSON.stringify(responseJson)}`)
        return Promise.resolve()
    })
    await watcher.on("productUpdated", async (...args: any[]): Promise<any> => {
        const id = args[0]
        const body = args[1]
        const response = await apiClient.productUpdated(id, body)
        const responseJson = await response.json()
        log.info(`Product ${id} UPDATED ${JSON.stringify(body)}`)
        log.info(`Response code ${response.status}: ${JSON.stringify(responseJson)}`)
        return Promise.resolve()
    })
    await watcher.on("subscribed", async (...args: any[]): Promise<any> => {
        const body = args[0]
        const response = await apiClient.subscribe(body)
        const responseJson = await response.json()
        log.info(`Product ${body.product} subscribed ${JSON.stringify(body)}`)
        log.info(`Response code ${response.status}: ${JSON.stringify(responseJson)}`)
        return Promise.resolve()
    })
    await watcher.on("event", async (...args: any[]): Promise<any> => {
        const event = args[0]
        log.info(`Watcher detected event: ${JSON.stringify(event)}`)
        return Promise.resolve()
    })

    // write on disk how many blocks have been processed
    const store = new LastBlockStore(lastBlockDir)
    if (process.env["CI"]) {
        store.write(12340000)
    }
    await watcher.on("eventSuccessfullyProcessed", async (...args: any[]): Promise<any> => {
        const event = args[0]
        store.write(event.blockNumber.toString())
        return Promise.resolve()
    })

    // catch up the blocks that happened when we were gone
    let lastRecorded = store.read()

    let lastActual = await provider.getBlockNumber()
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

main()
    .catch((e: any): void => {
        log.error(`Unexpected error: ${e.stack}`)
        process.exit(1)
    })

log.error("Unexpected restart.")
