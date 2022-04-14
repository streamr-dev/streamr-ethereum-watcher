
import { BigNumber, Contract, providers, ContractReceipt, Wallet } from "ethers";

import { Chains, RPCProtocol } from "@streamr/config"
import CoreAPIClient from "./CoreAPIClient"

import { IMarketplace } from "../typechain/IMarketplace";
import IMarketplaceJson from "../artifacts/contracts/IMarketplace.sol/IMarketplace.json";

import IStreamRegistryJson from "../artifacts/contracts/IStreamRegistry.sol/IStreamRegistry.json"
import { IStreamRegistry, PermissionUpdatedEvent } from "../typechain/IStreamRegistry"

import Pino from "pino"
const log = Pino({
    name: "marketplace-watcher",
    level: "info"
})

// TODO: can these types be imported from elsewhere?
type EthereumAddress = string
type Permission = {
    canEdit: boolean
    canDelete: boolean
    publishExpiration: BigNumber
    subscribeExpiration: BigNumber
    canGrant: boolean
}

const {
    MARKETPLACE_CHAIN = "ethereum",
    REGISTRY_CHAIN = "streamr",
    DEVOPS_KEY = "0x628acb12df34bb30a0b2f95ec2e6a743b386c5d4f63aa9f338bec6f613160e78",
    PRODUCT_ID = "0x0000000000000000000000000000000000000000000000000000000000000001",
    STREAMR_API_URL = "http://10.200.10.1/api/v2",
    PLAYBACK_STARTING_BLOCK = "1",
} = process.env

async function start() {
    const chains = Chains.loadFromNodeEnv() // select "development" or "production" according to NODE_ENV

    const marketplaceAddress = chains[MARKETPLACE_CHAIN].contracts.Marketplace
    const marketplaceProvider = new providers.JsonRpcProvider(chains[MARKETPLACE_CHAIN].getRPCEndpointsByProtocol(RPCProtocol.HTTP)[0])
    const market = new Contract(marketplaceAddress, IMarketplaceJson.abi, marketplaceProvider) as IMarketplace

    const registryAddress = chains[REGISTRY_CHAIN].contracts.StreamRegistry
    const registryProvider = new providers.JsonRpcProvider(chains[REGISTRY_CHAIN].getRPCEndpointsByProtocol(RPCProtocol.HTTP)[0])
    const wallet = new Wallet(DEVOPS_KEY, registryProvider)
    const registry = new Contract(registryAddress, IStreamRegistryJson.abi, wallet) as IStreamRegistry

    const coreApiClient = new CoreAPIClient(
        STREAMR_API_URL,
        CoreAPIClient.DEFAULT_FETCH_FUNC,
        CoreAPIClient.DEFAULT_GET_SESSION_TOKEN_FUNC,
        DEVOPS_KEY
    )

    // TODO: noticing an event triggers a "playback" using getPastEvents
    // TODO: getPastEvents is called periodically anyway, so that events get noticed even if real-time subscription fails
    market.on(market.filters.Subscribed(PRODUCT_ID), (PRODUCT_ID, subscriber, endTimestamp) => {
        log.info("Adding subscription to %s by %s ending at %s", PRODUCT_ID, subscriber, endTimestamp.toString())
        addSubscription(coreApiClient, registry, PRODUCT_ID, subscriber, endTimestamp)
            .then(logReceipt)
            .catch((e: Error) => {
                log.error("Failed to add subscription: %o", e)
            })
    })
}
start().catch(console.error)

async function addSubscription(
    coreApiClient: CoreAPIClient,
    registry: IStreamRegistry,
    productId: string,
    subscriberAddress: EthereumAddress,
    subscriptionEndTimestamp: BigNumber
): Promise<ContractReceipt> {
    const now = BigNumber.from(Math.floor(Date.now() / 1000).toString()) // remove milliseconds
    const productStreams = await coreApiClient.getProductStreams(productId)

    // first find the existing permissions, then augment the subscribe expiration period (if still relevant)
    const streams: string[] = []
    const permissions: Permission[] = []
    for (const streamId of productStreams) {
        try {
            const { canEdit, canDelete, publishExpiration, subscribeExpiration, canGrant }: Permission = await registry.getDirectPermissionsForUser(streamId, subscriberAddress)
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

    if (streams.length < 1) {
        log.info("No permission changes needed")
        return
    }

    // function trustedSetPermissions(string[] calldata streamids, address[] calldata users, Permission[] calldata permissions)
    const tx = await registry.trustedSetPermissions(
        streams,
        streams.map(() => subscriberAddress),
        permissions,
    )
    return tx.wait()
}

function logReceipt(tr: ContractReceipt) {
    const summary = {
        to: tr.to,
        from: tr.from,
        gasUsed: tr.gasUsed?.toString(),
        blockHash: tr.blockHash,
        transactionHash: tr.transactionHash,
        events: tr?.events?.map(e => e.event),
    }
    log.info("trustedSetPermissions receipt: %o", summary)
    const updateEvent = tr.events?.find(e => e.event === "PermissionUpdated") as PermissionUpdatedEvent
    if (!updateEvent) {
        log.warn("No PermissionUpdated event found!")
    }
    log.info("PermissionUpdated event: %o", {
        streamId: updateEvent.args.streamId,
        user: updateEvent.args.user,
        canEdit: updateEvent.args.canEdit,
        canDelete: updateEvent.args.canDelete,
        publishExpiration: updateEvent.args.publishExpiration.toString(),
        publishExpirationDate: new Date(updateEvent.args.publishExpiration.mul(1000).toString()),
        subscribeExpiration: updateEvent.args.subscribeExpiration.toString(),
        subscribeExpirationDate: new Date(updateEvent.args.subscribeExpiration.mul(1000).toString()),
        canGrant: updateEvent.args.canGrant,
        blockNumber: updateEvent.blockNumber,
        transactionIndex: updateEvent.transactionIndex,
        transactionLogIndex: updateEvent.logIndex,
    })
}
