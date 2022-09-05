
import dotenv from "dotenv"
import { ethers } from "ethers"
import { BigNumber } from "ethers/utils"
import { ContractReceipt } from "ethers/contract"

import log from "./log"
import { getEnv } from "./env"
import LastBlockStore from "./LastBlockStore"
import { throwIfNotContract } from "./checkArguments"
import Watcher from "./watcher"
import CoreAPIClient from "./CoreAPIClient"

import MarketplaceJSON from "../lib/marketplace-contracts/build/contracts/MarketplaceV3.json"
import StreamRegistryJSON from "../lib/streamregistry/StreamRegistryV3.json"

dotenv.config() // load .env file

type EthereumAddress = string
type Permission = {
    canEdit: boolean
    canDelete: boolean
    publishExpiration: BigNumber
    subscribeExpiration: BigNumber
    canGrant: boolean
}

/**
 * Check this.market really looks like a Marketplace and not something funny
 */
async function checkMarketplaceAddress(abi: any, market: ethers.Contract): Promise<void> {
    const getterNames: string = abi
        .filter((f: any) => (f.constant || f.stateMutability === "view") && f.inputs.length === 0)
        .map((f: any) => f.name)
    log.info(`Checking the Marketplace contract at ${market.address}`)
    let msg = ""
    for (const getterName of getterNames) {
        try {
            const value = await market[getterName]()
            msg += ` ${getterName}: ${value},\n`
        } catch (e) {
            msg += ` ${getterName}: NOT FOUND!,\n`
        }
    }
    log.info(msg)
}

async function main(): Promise<void> {
    const MARKETPLACE_ADDRESS = "MARKETPLACE_ADDRESS"
    const marketplaceAddress: string = getEnv(MARKETPLACE_ADDRESS)
    const streamRegistryAddress = getEnv("STREAM_REGISTRY_ADDRESS")
    const NETWORK_ID = "NETWORK_ID"
    const networkId: string = getEnv(NETWORK_ID)
    const ETHEREUM_SERVER_URL = "ETHEREUM_SERVER_URL"
    const ethereumServerURL: string = getEnv(ETHEREUM_SERVER_URL)
    const maticServerURL: string = getEnv("MATIC_SERVER_URL")
    const STREAMR_API_URL = "STREAMR_API_URL"
    const streamrApiURL: string = getEnv(STREAMR_API_URL)
    const DEVOPS_KEY = "DEVOPS_KEY"
    const devopsKey: string = getEnv(DEVOPS_KEY)
    const LAST_BLOCK_DIR = "LAST_BLOCK_DIR"
    const lastBlockDir: string = getEnv(LAST_BLOCK_DIR)
    const fallbackCatchUpIntervalMs = parseInt(getEnv("FALLBACK_CATCH_UP_INTERVAL_MS") || "3600000")
    const redundantPlaybackBlocks = parseInt(getEnv("REDUNDANT_PLAYBACK_BLOCKS") || "50")
    const redundantPlaybackMs = parseInt(getEnv("REDUNDANT_PLAYBACK_MS") || "600000")

    try {
        new ethers.Wallet(devopsKey)
    } catch (e: unknown) {
        log.error(`Expected a valid Ethereum key for environment variable ${DEVOPS_KEY}="${devopsKey}".`)
        process.exit(1)
    }
    let provider: ethers.providers.Provider
    if (networkId) {
        if (ethereumServerURL) {
            provider = new ethers.providers.JsonRpcProvider(ethereumServerURL)
        } else {
            provider = ethers.getDefaultProvider(networkId)
        }
    } else if (ethereumServerURL) {
        provider = new ethers.providers.JsonRpcProvider(ethereumServerURL)
    } else {
        log.error(`Requires ${ETHEREUM_SERVER_URL} or ${NETWORK_ID} environment variables!`)
        process.exit(1)
    }

    const network = await provider.getNetwork().catch(e => {
        log.error(`Connecting to Ethereum failed, ${NETWORK_ID}=${networkId} ${ETHEREUM_SERVER_URL}=${ethereumServerURL}: ${e.message}`)
        process.exit(1)
    })
    log.info("Connected to Ethereum network: ", JSON.stringify(network))

    const maticProvider = new ethers.providers.JsonRpcProvider(maticServerURL)
    const maticWallet = new ethers.Wallet(devopsKey, maticProvider)

    // deployed using truffle, mainnet tx: https://etherscan.io/tx/0x868a6604e6c33ebc52a3fe5d020d970fdd0019e8eb595232599d67f91624d877
    const deployedMarketplaceAddress = "0x2b3F2887c697B3f4f8D9F818c95482e1a3A759A5"

    const deployedRegistryAddress = "0x0D483E10612F327FC11965Fc82E90dC19b141641"

    const addr = marketplaceAddress || deployedMarketplaceAddress
    if (!addr) {
        log.error("MARKETPLACE_ADDRESS environment variable not set!")
        process.exit(1)
    }
    const marketAddress = await throwIfNotContract(provider, marketplaceAddress || deployedMarketplaceAddress)
    const registryAddress = await throwIfNotContract(maticProvider, streamRegistryAddress || deployedRegistryAddress)

    const registryContract = new ethers.Contract(registryAddress, StreamRegistryJSON.abi, maticWallet)
    const marketplaceContract = new ethers.Contract(marketAddress, MarketplaceJSON.abi, provider)
    const watcher = new Watcher(provider, marketplaceContract)
    const apiClient = new CoreAPIClient(
        streamrApiURL,
        CoreAPIClient.DEFAULT_FETCH_FUNC,
        CoreAPIClient.DEFAULT_GET_SESSION_TOKEN_FUNC,
        devopsKey,
    )

    await checkMarketplaceAddress(MarketplaceJSON.abi, marketplaceContract)

    await watcher.on("subscribed", async (args: {
            blockNumber: number,
            blockIndex: number,
            product: string,
            address: EthereumAddress,
            endsAt: string,
    }) => {
        const {
            blockNumber,
            blockIndex,
            product: productId,
            address,
            endsAt,
        } = args
        log.info(`Subscribed event at block ${blockNumber} index: ${blockIndex}, until ${endsAt}`)

        const subscriptionEndTimestamp = new BigNumber(endsAt)
        const now = new BigNumber(Math.floor(Date.now() / 1000).toString()) // remove milliseconds

        const productResponse = await apiClient.getProduct(productId)
        const product: { streams?: string[] } = await productResponse.json().catch((e: Error) => {
            log.error(`Failed to parse product ${productId}: ${e.message}`)
            return {}
        })

        if (!product.streams) {
            log.error(`No streams found for product ${productId}`)
            return
        }

        // first find the existing permissions, then augment the subscribe expiration period (if still relevant)
        const streams: string[] = []
        const permissions: Permission[] = []
        for (const streamId of product.streams) {
            try {
                const { canEdit, canDelete, publishExpiration, subscribeExpiration, canGrant }: Permission = await registryContract.getDirectPermissionsForUser(streamId, address)
                log.info("Old permission for stream %s: expires at %s, now is %s (subscribe until %s)", streamId, subscribeExpiration.toString(), now.toString(), subscriptionEndTimestamp.toString())
                if (subscriptionEndTimestamp.gt(subscribeExpiration) && subscriptionEndTimestamp.gt(now)) {
                    log.info("New permission for stream %s: expires at %s", streamId, subscriptionEndTimestamp.toString())
                    streams.push(streamId)
                    permissions.push({ canEdit, canDelete, publishExpiration, subscribeExpiration: subscriptionEndTimestamp, canGrant })
                }
            } catch (e: unknown) {
                log.error("Failed to get permissions for stream %s: %o", streamId, e)
            }
        }

        if (streams.length > 0) {
            // function trustedSetPermissions(string[] calldata streamids, address[] calldata users, Permission[] calldata permissions)
            const tx = await registryContract.trustedSetPermissions(
                streams,
                streams.map(() => address),
                permissions,
            )
            await tx.wait()
                .then((tr: ContractReceipt) => {
                    const summary = {
                        to: tr.to,
                        from: tr.from,
                        gasUsed: tr.gasUsed?.toString(),
                        blockHash: tr.blockHash,
                        transactionHash: tr.transactionHash,
                        events: tr?.events?.map(e => e.event),
                    }
                    log.info("Got trustedSetPermissions receipt: %o", summary)
                    const updateEvent = tr.events?.find(e => e.event === "PermissionUpdated")
                    if (!updateEvent) {
                        log.warn("No PermissionUpdated event found!")
                        return
                    }
                    log.info("PermissionUpdated event: %o", {
                        streamId: updateEvent.args?.[0],
                        user: updateEvent.args?.[1],
                        canEdit: updateEvent.args?.[2],
                        canDelete: updateEvent.args?.[3],
                        publishExpiration: updateEvent.args?.[4].toString(),
                        publishExpirationDate: new Date(updateEvent.args?.[4] * 1000),
                        subscribeExpiration: updateEvent.args?.[5].toString(),
                        subscribeExpirationDate: new Date(updateEvent.args?.[5] * 1000),
                        canGrant: updateEvent.args?.[6],
                        blockNumber: updateEvent.blockNumber,
                        transactionIndex: updateEvent.transactionIndex,
                        transactionLogIndex: updateEvent.transactionLogIndex,
                    })
                }).catch((e: Error) => {
                    log.error("Failed to set permissions: %o", e)
                    log.error(e.message)
                })
        } else {
            log.info("No permission changes needed")
        }
    })

    await watcher.on("productDeployed", async (id: string, body: any) => {
        const response = await apiClient.setDeployed(id, body)
        const responseJson = await response.json()
        log.info(`Product ${id} deployed ${JSON.stringify(body)}`)
        log.info(`Response code ${response.status}: ${JSON.stringify(responseJson)}`)
    })
    await watcher.on("productUndeployed", async (id: string, body: any) => {
        const response = await apiClient.setUndeployed(id, body)
        const responseJson = await response.json()
        log.info(`Product ${id} UNdeployed ${JSON.stringify(body)}`)
        log.info(`Response code ${response.status}: ${JSON.stringify(responseJson)}`)
    })
    await watcher.on("productUpdated", async (id: string, body: any) => {
        const response = await apiClient.productUpdated(id, body)
        const responseJson = await response.json()
        log.info(`Product ${id} UPDATED ${JSON.stringify(body)}`)
        log.info(`Response code ${response.status}: ${JSON.stringify(responseJson)}`)
    })

    // write on disk how many blocks have been processed
    const store = new LastBlockStore(lastBlockDir)
    await watcher.on("eventSuccessfullyProcessed", async (event: any) => {
        store.write(event.blockNumber.toString())
    })

    // playback the blocks that happened since the last catchUp
    const catchUp = async function(): Promise<void> {
        let lastRecorded = store.read()
        log.info("Playing back blocks since %d", lastRecorded)

        let lastActual = await provider.getBlockNumber()
        while (lastRecorded < lastActual) {
            log.info(`Playing back blocks ${lastRecorded + 1}...${lastActual} (inclusive)`)
            await watcher.playback(lastRecorded + 1, lastActual)
            store.write(lastActual)
            lastRecorded = lastActual
            lastActual = await provider.getBlockNumber()
        }
    }
    await catchUp()
    log.info("Playback done. Starting watcher...")

    // report new blocks as they arrive
    await watcher.start()

    // fallback in case watcher doesn't notice blocks: regular catchUps
    setInterval(catchUp, fallbackCatchUpIntervalMs)

    // fallback just to redundantly play back recent blocks
    const redundantPlayback = async function(): Promise<void> {
        const currentBlock = await provider.getBlockNumber()
        const fromBlock = currentBlock - redundantPlaybackBlocks
        log.info("Redundant playback %d...%d", fromBlock, currentBlock)
        await watcher.playback(fromBlock, currentBlock)
    }
    setInterval(redundantPlayback, redundantPlaybackMs)
}

main()
    .catch((e: Error): void => {
        log.error(`Unexpected error: ${e.stack}`)
        process.exit(1)
    })
