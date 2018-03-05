const EventEmitter = require("events")
const Web3utils = require("web3-utils")

const Marketplace = require("../lib/marketplace-contracts/build/contracts/Marketplace.json")

const currencySymbol = [
    "DATA",
    "USD"
]

class Watcher extends EventEmitter {
    constructor(web3, marketplaceAddress) {
        super()
        this.market = new web3.eth.Contract(Marketplace.abi, marketplaceAddress)
    }

    /**
     * Start watching incoming blocks
     */
    start() {
        const self = this
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
        this.market.events.ProductCreated({}, onDeployEvent)
        this.market.events.ProductRedeployed({}, onDeployEvent)
        this.market.events.ProductDeleted({}, event => {
            self.emit("productUndeployed", event.returnValues.productId, {})
        })

        function onDeployEvent(error, event) {
            if (error) {
                throw error
            }
            event.productId = Web3utils.hexToString(event.returnValues.id)
            if (event.removed) {
                console.warn("Blockchain reorg may have dropped an event: " + JSON.stringify(event))
                return
            }
            self.emit("productDeployed", event.productId, {
                blockNumber: event.blockNumber,
                blockIndex: event.transactionIndex,
                ownerAddress: event.returnValues.owner,
                beneficiaryAddress: event.returnValues.beneficiary,
                pricePerSecond: event.returnValues.pricePerSecond,
                priceCurrency: currencySymbol[event.returnValues.currency],
                minimumSubscriptionInSeconds: event.returnValues.minimumSubscriptionSeconds
            })
        }

        this.market.events.allEvents()
            .on("data", event => {
                self.emit("event", event)
            })
            .on("changed", event => {
                log.warn("Blockchain reorg may have dropped an event: " + JSON.stringify(event))
            })
            .on("error", error => {
                self.emit("error", error)
            })
    }


}

module.exports = Watcher
