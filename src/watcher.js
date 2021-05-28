const log = require("./log")
const EventEmitter = require("promise-events")
const ethers = require("ethers")
const Marketplace = require("../lib/marketplace-contracts/build/contracts/Marketplace.json")
const {Marketplace: {currencySymbol}} = require("../lib/marketplace-contracts/src/contracts/enums")

const EE_PRICE_SCALE = new ethers.utils.BigNumber(1e9)  // scale price to "nanotokens"/token-gwei so that it fits into mysql and Java long
// "warp" to this block; before this block there weren't (too many) events
const playbackStartBlock = {
    "1": 12359784,      // mainnet, start from 2021-05-03
    "4": 1920000,       // rinkeby
}
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
class Watcher extends EventEmitter {
    constructor(provider, marketplaceAddress) {
        super()
        this.provider = provider
        this.abi = Marketplace.abi
        playbackStartBlock["1"] = 9814860
        this.market = new ethers.Contract(marketplaceAddress, this.abi, provider)
    }

    /**
     * Check this.market really looks like a Marketplace and not something funny
     */
    async checkMarketplaceAddress() {
        const getterNames = this.abi
            .filter(f => f.constant && f.inputs.length === 0)
            .map(f => f.name)
        let msg = ""
        for (const getterName of getterNames) {
            const value = await this.market[getterName]()
            msg += ` ${getterName}: ${value},`
        }
        log.info(`Watcher > Checking the Marketplace contract at ${this.market.address}: ${msg}`)
    }

    /**
     * Start watching incoming blocks
     */
    async start() {
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

        this.provider.on({address: this.market.address}, logEntry => {
            log.info("Watcher > Event logged at " + logEntry.blockNumber)
        })
    }

    // for filter callback, see https://docs.ethers.io/ethers.js/html/api-contract.html#event-object
    watchEvent(eventName, handler) {
        const filter = this.market.filters[eventName]()
        const self = this
        this.market.on(filter, (...args) => {
            const event = args.pop()
            log.info(`Watcher > Event: ${event.event}, args: ${JSON.stringify(args.map(a => a.toString()))}`)
            handler.call(self, event.blockNumber, event.transactionIndex, event.args)
                .catch(async (e) => {
                    await self.emit("error", e)
                    log.error("Watcher > Error while sending event: " + e.stack)
                })
        })
    }

    async logEvent(...args) {
        const eventObject = args.pop()
        log.warn(`Watcher > Event ignored: ${eventObject.event}, args: ${JSON.stringify(args.map(a => a.toString()))}`)
    }

    // SYNCHRONOUSLY play back events one by one. Wait for promise to return before sending the next one
    async playbackStep(fromBlock, toBlock) {
        log.info(`Watcher > Getting events from blocks ${fromBlock}...${toBlock}`)
        const filter = {
            fromBlock,
            toBlock,
            address: this.market.address,
        }
        const events = await this.provider.getLogs(filter)
        log.info(`Watcher > Playing back ${events.length} events`)
        for (let raw of events) {
            const event = this.market.interface.parseLog(raw)
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
                    continue
                }
                throw e
            }
        }
    }

    // playback in steps to avoid choking Infura
    // see https://github.com/INFURA/infura/issues/54
    async playback(fromBlock, toBlock) {
        if (!this.networkId) {
            const network = await this.provider.getNetwork()
            this.networkId = network.chainId
        }
        let b = fromBlock

        // before start there weren't too many events to choke infura
        const start = playbackStartBlock[this.networkId] || 0
        if (fromBlock < start) {
            await this.playbackStep(fromBlock, start - 1)
            b = start
        }
        while (b < toBlock - playbackStep) {
            await this.playbackStep(b, b + playbackStep)
            b += playbackStep
            await this.emit("eventSuccessfullyProcessed", {blockNumber: b - 1})
        }
        await this.playbackStep(b, toBlock)
    }

    onDeployEvent(blockNumber, blockIndex, args) {
        const productId = args.id.slice(2)    // remove "0x" from beginning
        return this.emit("productDeployed", productId, {
            blockNumber,
            blockIndex,
            ownerAddress: args.owner,
            beneficiaryAddress: args.beneficiary,
            pricePerSecond: args.pricePerSecond.div(EE_PRICE_SCALE).toString(),
            priceCurrency: currencySymbol[args.currency],
            minimumSubscriptionInSeconds: args.minimumSubscriptionSeconds.toString(),
        })
    }

    onUpdateEvent(blockNumber, blockIndex, args) {
        const productId = args.id.slice(2)    // remove "0x" from beginning
        return this.emit("productUpdated", productId, {
            blockNumber,
            blockIndex,
            ownerAddress: args.owner,
            beneficiaryAddress: args.beneficiary,
            pricePerSecond: args.pricePerSecond.div(EE_PRICE_SCALE).toString(),
            priceCurrency: currencySymbol[args.currency],
            minimumSubscriptionInSeconds: args.minimumSubscriptionSeconds.toString(),
        })
    }

    onUndeployEvent(blockNumber, blockIndex, args) {
        const productId = args.id.slice(2)    // remove "0x" from beginning
        return this.emit("productUndeployed", productId, {
            blockNumber,
            blockIndex,
        })
    }

    onSubscribeEvent(blockNumber, blockIndex, args) {
        const productId = args.productId.slice(2)    // remove "0x" from beginning
        return this.emit("subscribed", {
            blockNumber,
            blockIndex,
            product: productId,
            address: args.subscriber,
            endsAt: args.endTimestamp.toString(),
        })
    }

    async onOwnershipUpdateEvent(blockNumber, blockIndex, args) {
        const productId = args.id.slice(2)    // remove "0x" from beginning
        const product = await this.market.getProduct(args.id)
        await this.emit("productUpdated", productId, {
            blockNumber,
            blockIndex,
            ownerAddress: product.owner,
            beneficiaryAddress: product.beneficiary,
            pricePerSecond: product.pricePerSecond.div(EE_PRICE_SCALE).toString(),
            priceCurrency: currencySymbol[product.currency],
            minimumSubscriptionInSeconds: product.minimumSubscriptionSeconds.toString(),
        })
    }
}

module.exports = Watcher
