import log from "./log"
import EventEmitter from "promise-events"
import {ethers} from "ethers"
import * as MarketplaceEnums from "./MarketplaceEnums"
import {LogDescription} from "ethers/utils"

const EE_PRICE_SCALE = new ethers.utils.BigNumber(1e9)  // scale price to "nanotokens"/token-gwei so that it fits into mysql and Java long
// "warp" to this block; before this block there weren't (too many) events
const playbackStartBlock: Map<number, number> = new Map()
playbackStartBlock.set(1, 12359784) // mainnet, start from 2021-05-03
playbackStartBlock.set(4, 1920000) // rinkeby
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
 *
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
    private networkId = 0

    constructor(
            private readonly provider: ethers.providers.Provider,
            private readonly marketplaceAbi: any[],
            private readonly market: ethers.Contract) {
        super()
        this.provider = provider
        this.marketplaceAbi = marketplaceAbi
        this.market = market
    }

    /**
     * Check this.market really looks like a Marketplace and not something funny
     */
    async checkMarketplaceAddress(): Promise<void> {
        const getterNames: any[] = this.marketplaceAbi
            .filter(f => f.constant && f.inputs.length === 0)
            .map(f => f.name)
        let msg = ""
        for (const getterName of getterNames) {
            const value = await this.market[getterName]()
            msg += ` ${getterName}: ${value},`
        }
        log.info(`Watcher > Checking the Marketplace contract at ${this.market.address}: ${msg}`)
        return Promise.resolve()
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
        this.watchEvent("ExchangeRatesUpdated", this.logEvent)

        this.provider.on(this.market.address, (...args: Array<any>): void => {
            log.info("Watcher > Event logged at " + JSON.stringify(args))
        })
        return Promise.resolve()
    }

    // for filter callback, see https://docs.ethers.io/v4/api-contract.html#event-object
    watchEvent(eventName: string, handler: (...args: any[]) => Promise<any>): void {
        const filter = this.market.filters[eventName]()
        this.market.on(filter, async (...args: any[]): Promise<void> => {
            const event = args.pop()
            log.info(`Watcher > Event: ${event.event}, args: ${JSON.stringify(args)}`)
            try {
                await handler.call(this, event.blockNumber, event.transactionIndex, event.args)
            } catch (e) {
                log.error("Watcher > error while sending event: " + e.stack)
                this.emit("error", e)
                    .catch((err: Error) => {
                        log.error(`Watcher > error while emitting error from watchEvent: ${err.message}`)
                    })
            }
        })
    }

    async logEvent(...args: any[]): Promise<any> {
        log.warn(`Watcher > Event ignored: ${JSON.stringify(args)}`)
        return Promise.resolve()
    }

    // SYNCHRONOUSLY play back events one by one. Wait for promise to return before sending the next one
    async playbackStep(fromBlock: number, toBlock: number): Promise<void> {
        log.info(`Watcher > Getting events from blocks ${fromBlock}...${toBlock}`)
        const filter = {
            fromBlock,
            toBlock,
            address: this.market.address,
        }
        const events: ethers.providers.Log[] = await this.provider.getLogs(filter)
        log.info(`Watcher > Playing back ${events.length} events`)
        for (const raw of events) {
            const event: LogDescription = this.market.interface.parseLog(raw)
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
            } catch (e) {
                // if it was because streamr backend couldn't find the product for set(Un)Deployed, just keep chugging
                if (e.code === "ECONNREFUSED") {
                    log.warn(`Watcher > connection refused: ${e.message}`)
                    continue
                } else {
                    log.error(`Watcher > unexpected error: ${e.message}`)
                }
                return Promise.reject()
            }
        }
        return Promise.resolve()
    }

    // playback in steps to avoid choking Infura
    // see https://github.com/INFURA/infura/issues/54
    async playback(fromBlock: number, toBlock: number): Promise<void> {
        if (!this.networkId) {
            const network = await this.provider.getNetwork()
            this.networkId = network.chainId
        }
        let b = fromBlock

        // before start there weren't too many events to choke infura
        const start = playbackStartBlock.get(this.networkId) || 0
        if (fromBlock < start) {
            await this.playbackStep(fromBlock, start - 1)
            b = start
        }
        while (b < toBlock - playbackStep) {
            await this.playbackStep(b, b + playbackStep)
            b += playbackStep
            await this.emit("eventSuccessfullyProcessed", {blockNumber: b - 1})
        }
        return await this.playbackStep(b, toBlock)
    }

    async onDeployEvent(blockNumber: any, blockIndex: any, args: any): Promise<any> {
        const productId = args.id.slice(2)    // remove "0x" from beginning
        return this.emit("productDeployed", productId, {
            blockNumber,
            blockIndex,
            ownerAddress: args.owner,
            beneficiaryAddress: args.beneficiary,
            pricePerSecond: args.pricePerSecond.div(EE_PRICE_SCALE).toString(),
            priceCurrency: MarketplaceEnums.CurrencySymbol[args.currency],
            minimumSubscriptionInSeconds: args.minimumSubscriptionSeconds.toString(),
        })
    }

    async onUpdateEvent(blockNumber: any, blockIndex: any, args: any): Promise<any> {
        const productId = args.id.slice(2)    // remove "0x" from beginning
        return this.emit("productUpdated", productId, {
            blockNumber,
            blockIndex,
            ownerAddress: args.owner,
            beneficiaryAddress: args.beneficiary,
            pricePerSecond: args.pricePerSecond.div(EE_PRICE_SCALE).toString(),
            priceCurrency: MarketplaceEnums.CurrencySymbol[args.currency],
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
        let product
        try {
            product = await this.market.getProduct(args.id)
        } catch (err) {
            log.error(`Error while retrieving product from blockchain: ${err.message}`)
            throw err
        }
        return this.emit("productUpdated", productId, {
            blockNumber,
            blockIndex,
            ownerAddress: product.owner,
            beneficiaryAddress: product.beneficiary,
            pricePerSecond: product.pricePerSecond.div(EE_PRICE_SCALE).toString(),
            priceCurrency: MarketplaceEnums.CurrencySymbol[product.currency],
            minimumSubscriptionInSeconds: product.minimumSubscriptionSeconds.toString(),
        })
    }
}
