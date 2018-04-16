const EventEmitter = require("promise-events")
const Web3utils = require("web3-utils")

const Marketplace = require("../lib/marketplace-contracts/build/contracts/Marketplace.json")

const { Marketplace: { currencySymbol } } = require("../lib/marketplace-contracts/src/contracts/enums")

const RINKEBY = 4
const MAINNET = 1

// "warp" to this block; before this block there weren't (too many) events
const playbackStartBlock = {
    [MAINNET]: 5450000,
    [RINKEBY]: 1920000
}
const playbackStep = 1000

/**
 * Watcher generates Node events when Marketplace contract events show up in Ethereum blocks
 */
class Watcher extends EventEmitter {
    constructor(web3, marketplaceAddress) {
        super()
        this.market = new web3.eth.Contract(Marketplace.abi, marketplaceAddress)
        this.web3 = web3
    }

    /*
    // product events
    event ProductCreated(address indexed owner, bytes32 indexed id, string name, address beneficiary, uint pricePerSecond, Currency currency, uint minimumSubscriptionSeconds);
    event ProductUpdated(address indexed owner, bytes32 indexed id, string name, address beneficiary, uint pricePerSecond, Currency currency, uint minimumSubscriptionSeconds);
    event ProductDeleted(address indexed owner, bytes32 indexed id);
    event ProductRedeployed(address indexed owner, bytes32 indexed id);
    event ProductOwnershipOffered(address indexed owner, bytes32 indexed id, address indexed to);
    event ProductOwnershipChanged(address indexed newOwner, bytes32 indexed id, address indexed oldOwner);

    // subscription events
    event Subscribed(bytes32 indexed productId, address indexed subscriber, uint endTimestamp);
    event NewSubscription(bytes32 indexed productId, address indexed subscriber, uint endTimestamp);
    event SubscriptionExtended(bytes32 indexed productId, address indexed subscriber, uint endTimestamp);
    event SubscriptionTransferred(bytes32 indexed productId, address indexed from, address indexed to, uint secondsTransferred, uint datacoinTransferred);

    // currency events
    event ExchangeRatesUpdated(uint timestamp, uint dataInUsd);
    */

    /**
     * Start watching incoming blocks
     */
    start() {
        if (this.isRunning) {
            throw new Error("Already started!")
        }
        this.isRunning = true

        // TODO: refactor ProductCreated activates onProductCreated (not onDeployEvent)
        // TODO: autogenerate these bindings from a list maybe
        this.market.events.ProductCreated({}, this.handleEvent.bind(this, this.onDeployEvent))
        this.market.events.ProductRedeployed({}, this.handleEvent.bind(this, this.onDeployEvent))
        this.market.events.ProductDeleted({}, this.handleEvent.bind(this, this.onUndeployEvent))
        this.market.events.ProductUpdated({}, this.handleEvent.bind(this, this.onUpdateEvent))
        this.market.events.ProductOwnershipChanged({}, this.handleEvent.bind(this, this.onOwnershipUpdateEvent))
        this.market.events.Subscribed({}, this.handleEvent.bind(this, this.onSubscribeEvent))

        const self = this
        this.market.events.allEvents()
            .on("data", event => {
                self.emit("event", event)
            })
            .on("changed", event => {
                console.warn("Blockchain reorg may have dropped an event: " + JSON.stringify(event))
            })
            .on("error", error => {
                self.emit("error", error)
            })
    }

    handleEvent(handler, error, event) {
        const self = this
        handler.bind(this)(error, event).then(this.logger).then(async () => {
            await self.emit("eventSuccessfullyProcessed", event)
        })
    }

    logger() {
        // log nothing by default, allow override for logging
    }

    // SYNCHRONOUSLY play back events one by one. Wait for promise to return before sending the next one
    async playbackStep(fromBlock, toBlock) {
        this.logger(`  Getting events from blocks ${fromBlock}...${toBlock}`)
        const events = await this.market.getPastEvents("allevents", {fromBlock, toBlock})
        this.logger(`    Playing back ${events.length} events`)
        for (let ev of events) {
            switch (ev.event) {
                case "ProductCreated": await this.onDeployEvent(null, ev); break;
                case "ProductRedeployed": await this.onDeployEvent(null, ev); break;
                case "ProductDeleted": await this.onUndeployEvent(null, ev); break;
                case "ProductUpdated": await this.onUpdateEvent(null, ev); break;
                case "ProductOwnershipChanged": await this.onOwnershipUpdateEvent(null, ev); break;
                case "Subscribed": await this.onSubscribeEvent(null, ev); break;
            }
        }
    }

    // playback in steps to avoid choking Infura
    // see https://github.com/INFURA/infura/issues/54
    async playback(fromBlock, toBlock) {
        if (!this.networkId) {
            this.networkId = await this.web3.eth.net.getId()
        }
        let b = fromBlock

        // before start there weren't too many events to choke infura
        const start = playbackStartBlock[this.networkId]
        if (fromBlock < start) {
            await this.playbackStep(fromBlock, start - 1)
            b = start
        }
        while (b < toBlock - playbackStep) {
            await this.playbackStep(b, b + playbackStep)
            b += playbackStep
        }
        await this.playbackStep(b, toBlock)
    }



    onDeployEvent(error, event) {
        if (error) {
            throw error
        }
        if (event.removed) {
            // TODO: how to react? Fire a productUndeployed?
            console.error("Blockchain reorg may have dropped an event: " + JSON.stringify(event))
            return
        }

        const productId = event.returnValues.id.slice(2)    // remove "0x" from beginning
        return this.emit("productDeployed", productId, {
            blockNumber: event.blockNumber,
            blockIndex: event.transactionIndex,
            ownerAddress: event.returnValues.owner,
            beneficiaryAddress: event.returnValues.beneficiary,
            pricePerSecond: event.returnValues.pricePerSecond,
            priceCurrency: currencySymbol[event.returnValues.currency],
            minimumSubscriptionInSeconds: event.returnValues.minimumSubscriptionSeconds
        })
    }

    onUpdateEvent(error, event) {
        if (error) {
            throw error
        }
        if (event.removed) {
            // TODO: how to react? Send another Update event with old info?
            console.error("Blockchain reorg may have dropped an event: " + JSON.stringify(event))
            return
        }

        const productId = event.returnValues.id.slice(2)    // remove "0x" from beginning
        return this.emit("productUpdated", productId, {
            blockNumber: event.blockNumber,
            blockIndex: event.transactionIndex,
            ownerAddress: event.returnValues.owner,
            beneficiaryAddress: event.returnValues.beneficiary,
            pricePerSecond: event.returnValues.pricePerSecond,
            priceCurrency: currencySymbol[event.returnValues.currency],
            minimumSubscriptionInSeconds: event.returnValues.minimumSubscriptionSeconds
        })
    }

    onUndeployEvent(error, event) {
        if (error) {
            throw error
        }
        if (event.removed) {
            // TODO: how to react? Fire a productDeployed?
            console.error("Blockchain reorg may have dropped an event: " + JSON.stringify(event))
            return
        }
        const productId = event.returnValues.id.slice(2)    // remove "0x" from beginning
        return this.emit("productUndeployed", productId, {
            blockNumber: event.blockNumber,
            blockIndex: event.transactionIndex
        })
    }

    onSubscribeEvent(error, event) {
        if (error) {
            throw error
        }
        const productId = event.returnValues.productId.slice(2)    // remove "0x" from beginning
        return this.emit("subscribed", {
            blockNumber: event.blockNumber,
            blockIndex: event.transactionIndex,
            product: productId,
            address: event.returnValues.subscriber,
            endsAt: event.returnValues.endTimestamp
        })
    }

    onOwnershipUpdateEvent(error, event) {
        if (error) {
            throw error
        }
        if (event.removed) {
            // TODO: how to react? Send another Update event with old info?
            console.error("Blockchain reorg may have dropped an event: " + JSON.stringify(event))
            return
        }
        //const productId = event.returnValues.id.slice(2)    // remove "0x" from beginning
        const productId = event.returnValues.id
        return this.market.methods.getProduct(productId).call().then(p => {
            return this.emit("productUpdated", productId, {
                blockNumber: event.blockNumber,
                blockIndex: event.transactionIndex,
                ownerAddress: p.owner,
                beneficiaryAddress: p.beneficiary,
                pricePerSecond: p.pricePerSecond,
                priceCurrency: currencySymbol[+p.currency],
                minimumSubscriptionInSeconds: p.minimumSubscriptionSeconds
            })
        })
    }
}

module.exports = Watcher
