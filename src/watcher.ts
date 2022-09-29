import log from "./log"
import EventEmitter from "promise-events"
import { ethers } from "ethers"
import { Log } from "ethers/providers/abstract-provider"

// "warp" to this block; before this block there weren't (too many) events
const playbackStartBlock = new Map<number, number>([
    [1, 14140263], // mainnet, start from 2022-02
    [4, 1920000], // rinkeby
])
const playbackStep = 1000

/**
 * Watcher generates Node events when Marketplace contract events show up in Ethereum blocks
 *
 * Exhaustive list of v3.1 contract events: (that's the mainnet deployment)
 *
 *  // product events
 *  event ProductCreated(address indexed owner, bytes32 indexed id, string name, address beneficiary, uint pricePerSecond, Currency currency, uint minimumSubscriptionSeconds);
 *  event ProductUpdated(address indexed owner, bytes32 indexed id, string name, address beneficiary, uint pricePerSecond, Currency currency, uint minimumSubscriptionSeconds);
 *  event ProductDeleted(address indexed owner, bytes32 indexed id);
 *  event ProductRedeployed(address indexed owner, bytes32 indexed id);
 *  event ProductOwnershipOffered(address indexed owner, bytes32 indexed id, address indexed to);
 *  event ProductOwnershipChanged(address indexed newOwner, bytes32 indexed id, address indexed oldOwner);
 *
 *  // subscription events
 *  event Subscribed(bytes32 indexed productId, address indexed subscriber, uint endTimestamp);
 *  event NewSubscription(bytes32 indexed productId, address indexed subscriber, uint endTimestamp);
 *  event SubscriptionExtended(bytes32 indexed productId, address indexed subscriber, uint endTimestamp);
 *  event SubscriptionTransferred(bytes32 indexed productId, address indexed from, address indexed to, uint secondsTransferred, uint datacoinTransferred);
 *
 *  // currency events
 *  event ExchangeRatesUpdated(uint timestamp, uint dataInUsd);
 */
export default class Watcher extends EventEmitter {
    private isRunning = false
    private networkId = -1

    constructor(private readonly provider: ethers.providers.Provider,
                private readonly market: ethers.Contract) {
        super()
    }

    /**
     * Start watching incoming blocks
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            throw new Error("Already started!")
        }

        this.isRunning = true
        log.info(`Watcher > Starting watcher for Marketplace at ${this.market.address}`)

        this.watchEvent("ProductCreated", this.onDeployEvent)
        this.watchEvent("ProductRedeployed", this.onDeployEvent)
        this.watchEvent("ProductDeleted", this.onUndeployEvent)
        this.watchEvent("ProductUpdated", this.onUpdateEvent)
        this.watchEvent("ProductOwnershipChanged", this.onOwnershipUpdateEvent)
        this.watchEvent("Subscribed", this.onSubscribeEvent)

        this.watchEvent("ProductOwnershipOffered", this.logEvent)
        this.watchEvent("NewSubscription", this.logEvent)
        this.watchEvent("SubscriptionExtended", this.logEvent)
        this.watchEvent("SubscriptionTransferred", this.logEvent)

        const listener = function (...args: Array<any>): void {
            const logEntry = args.pop()
            log.debug("Watcher > Event logged at " + logEntry.blockNumber)
        }
        this.provider.on({address: this.market.address}, listener)
        return Promise.resolve()
    }

    // for filter callback, see https://docs.ethers.io/ethers.js/html/api-contract.html#event-object
    watchEvent(eventName: string, handler: (...args: any[]) => Promise<any>): void {
        const filter = this.market.filters[eventName]()
        this.market.on(filter, (...args) => {
            const event = args.pop()
            log.info(`Watcher > Event: ${event.event}, args: ${JSON.stringify(args.map(a => a.toString()))}`)
            handler.call(this, event.blockNumber, event.transactionIndex, event.args)
                .catch(async (e) => {
                    await this.emit("error", e)
                    log.error("Watcher > Error while sending event: " + e.stack)
                })
        })
    }

    async logEvent(...args: any[]): Promise<void> {
        const eventObject = args.pop()
        log.warn(`Watcher > Event ignored: ${eventObject.event}, args: ${JSON.stringify(args.map(a => a.toString()))}`)
        return Promise.resolve()
    }

    // SYNCHRONOUSLY play back events one by one. Wait for promise to return before sending the next one
    async playbackStep(events: Array<Log>): Promise<void> {
        log.info(`Watcher > Playing back ${events.length} events`)
        for (const raw of events) {

            const event = this.market.interface.parseLog(raw)
            if (!event || !event.name || !event.values) { continue }
            try {
                switch (event.name) {
                    case "ProductCreated":
                        await this.onDeployEvent(raw.blockNumber, raw.transactionIndex, event.values)
                        break
                    case "ProductRedeployed":
                        await this.onDeployEvent(raw.blockNumber, raw.transactionIndex, event.values)
                        break
                    case "ProductDeleted":
                        await this.onUndeployEvent(raw.blockNumber, raw.transactionIndex, event.values)
                        break
                    case "ProductUpdated":
                        await this.onUpdateEvent(raw.blockNumber, raw.transactionIndex, event.values)
                        break
                    case "ProductOwnershipChanged":
                        await this.onOwnershipUpdateEvent(raw.blockNumber, raw.transactionIndex, event.values)
                        break
                    case "Subscribed":
                        await this.onSubscribeEvent(raw.blockNumber, raw.transactionIndex, event.values)
                        break
                }
            } catch (e: any) {
                log.error(`Watcher > unexpected error: ${e}`)
                // if it was because streamr backend couldn't find the product for set(Un)Deployed, just keep chugging
                if (e.code && e.code === "ECONNREFUSED") {
                    continue
                }
                throw e
            }
        }
    }

    async loadEventsFormBlockchain(fromBlock: number, toBlock: number): Promise<Array<Log>> {
        log.info(`Watcher > Getting events from blocks ${fromBlock}...${toBlock}`)
        const filter = {
            fromBlock,
            toBlock,
            address: this.market.address,
        }
        return this.provider.getLogs(filter)
    }

    // playback in steps to avoid choking Infura
    // see https://github.com/INFURA/infura/issues/54
    async playback(fromBlock: number, toBlock: number): Promise<void> {
        if (this.networkId === -1) {
            const network = await this.provider.getNetwork()
            this.networkId = network.chainId
        }
        let b = fromBlock

        const start = playbackStartBlock.get(this.networkId) || 0
        if (fromBlock < start) {
            const events: Array<Log> = await this.loadEventsFormBlockchain(fromBlock, start - 1)
            await this.playbackStep(events)
            b = start
        }
        while (b < toBlock - playbackStep) {
            const events: Array<Log> = await this.loadEventsFormBlockchain(b, b + playbackStep)
            await this.playbackStep(events)
            b += playbackStep
            await this.emit("eventSuccessfullyProcessed", {blockNumber: b - 1})
        }
        const events: Array<Log> = await this.loadEventsFormBlockchain(b, toBlock)
        await this.playbackStep(events)
        return Promise.resolve()
    }

    async onDeployEvent(blockNumber: any, blockIndex: any, args: any): Promise<any> {
        const productId = args.id.slice(2)    // remove "0x" from beginning
        // args.pricingTokenAddress ignored because core-api doesn't know it
        return this.emit("productDeployed", productId, {
            blockNumber,
            blockIndex,
            ownerAddress: args.owner,
            beneficiaryAddress: args.beneficiary,
            pricePerSecond: args.pricePerSecond.toString(),
            priceCurrency: "DATA",
            minimumSubscriptionInSeconds: args.minimumSubscriptionSeconds.toString(),
        })
    }

    async onUpdateEvent(blockNumber: any, blockIndex: any, args: any): Promise<any> {
        const productId = args.id.slice(2)    // remove "0x" from beginning
        // args.pricingTokenAddress ignored because core-api doesn't know it
        return this.emit("productUpdated", productId, {
            blockNumber,
            blockIndex,
            ownerAddress: args.owner,
            beneficiaryAddress: args.beneficiary,
            pricePerSecond: args.pricePerSecond.toString(),
            priceCurrency: "DATA",
            minimumSubscriptionInSeconds: args.minimumSubscriptionSeconds.toString(),
        })
    }

    async onUndeployEvent(blockNumber: any, blockIndex: any, args: any): Promise<any> {
        const productId = args.id.slice(2)    // remove "0x" from beginning
        return this.emit("productUndeployed", productId, {
            blockNumber,
            blockIndex,
        })
    }

    async onSubscribeEvent(blockNumber: any, blockIndex: any, args: any): Promise<any> {
        const productId = args.productId.slice(2)    // remove "0x" from beginning
        return this.emit("subscribed", {
            blockNumber,
            blockIndex,
            product: productId,
            address: args.subscriber,
            endsAt: args.endTimestamp.toString(),
        })
    }

    async onOwnershipUpdateEvent(blockNumber: any, blockIndex: any, args: any): Promise<any> {
        const productId = args.id.slice(2)    // remove "0x" from beginning
        const product = await this.market.getProduct(args.id)
        // args.pricingTokenAddress ignored because core-api doesn't know it
        return this.emit("productUpdated", productId, {
            blockNumber,
            blockIndex,
            ownerAddress: product.owner,
            beneficiaryAddress: product.beneficiary,
            pricePerSecond: product.pricePerSecond.toString(),
            priceCurrency: "DATA",
            minimumSubscriptionInSeconds: product.minimumSubscriptionSeconds.toString(),
        })
    }
}
