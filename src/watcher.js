const EventEmitter = require("promise-events")
const Web3utils = require("web3-utils")

const Marketplace = require("../lib/marketplace-contracts/build/contracts/Marketplace.json")

const currencySymbol = [
    "DATA",
    "USD"
]

/**
 * Watcher generates Node events when Marketplace contract events show up in Ethereum blocks
 */
class Watcher extends EventEmitter {
    constructor(web3, marketplaceAddress) {
        super()
        this.market = new web3.eth.Contract(Marketplace.abi, marketplaceAddress)
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

        const self = this
        this.market.events.ProductCreated({}, (error, event) => self.onDeployEvent(error, event).then(self.logger))
        this.market.events.ProductRedeployed({}, (error, event) => self.onDeployEvent(error, event).then(self.logger))
        this.market.events.ProductDeleted({}, (error, event) => self.onUndeployEvent(error, event).then(self.logger))

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

    logger() {
        // log nothing by default, allow override for logging
    }

    // SYNCHRONOUSLY play back events one by one. Wait for promise to return before sending the next one
    async playback(fromBlock, toBlock) {
        for (let e of await this.market.getPastEvents("allevents", {fromBlock, toBlock})) {
            switch (e.event) {
                case "ProductDeployed": await this.onDeployEvent(null, e); break;
                case "ProductRedeployed": await this.onDeployEvent(null, e); break;
                case "ProductDeleted": await this.onUndeployEvent(null, e); break;
            }
        }
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
}

module.exports = Watcher
