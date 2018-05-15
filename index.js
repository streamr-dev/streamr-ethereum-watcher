const argv = require("yargs").argv
const fs = require("mz/fs")         // for persisting last processed block (to avoid full playback every restart)
const AWS = require('aws-sdk')        // for CloudWatch metrics

const {
    marketplaceAddress,
    networkId,
    ethereumServerURL,
    streamrApiURL,
    devopsKey,
    verbose,
    metrics,
    logDir = "logs"
} = argv

// network ids: 1 = mainnet, 2 = morden, 3 = ropsten, 4 = rinkeby (current testnet)
const defaultServers = {
    1: "wss://mainnet.infura.io/ws",
    4: "wss://rinkeby.infura.io/ws"
}

// Setting up CloudWatch service object, borrowed from https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/cloudwatch-examples-getting-metrics.html
AWS.config.update({region: "eu-west-1"})
const cw = new AWS.CloudWatch({apiVersion: "2010-08-01"})

var isMetric = (metrics == 'true');

const Web3 = require("web3")
const web3 = new Web3(ethereumServerURL || defaultServers[networkId] || "missing --ethereumServerURL or --networkId!")

const Marketplace = require("./lib/marketplace-contracts/build/contracts/Marketplace.json")
const deployedMarketplaceAddress = Marketplace.networks[networkId] && Marketplace.networks[networkId].address
if (marketplaceAddress && !web3.utils.isAddress(marketplaceAddress)) { throw new Error("Bad --marketplaceAddress " + marketplaceAddress) }
const marketAddress = marketplaceAddress || deployedMarketplaceAddress
if (!marketAddress) { throw new Error("Requires --marketplaceAddress or deployment through marketplace-contracts") }

const Watcher = require("./src/watcher")
const watcher = new Watcher(web3, marketAddress)

const Informer = require("./src/informer")
const informer = new Informer(streamrApiURL, devopsKey)

if (verbose) {
    watcher.on("productDeployed", (id, body) => { console.log(`Product ${id} deployed ${JSON.stringify(body)}`) })
    watcher.on("productUndeployed", (id, body) => { console.log(`Product ${id} UNdeployed ${JSON.stringify(body)}`) })
    watcher.on("productUpdated", (id, body) => { console.log(`Product ${id} UPDATED ${JSON.stringify(body)}`) })
    watcher.on("subscribed", (body) => { console.log(`Product ${body.product} subscribed ${JSON.stringify(body)}`) })
    if (verbose > 1) {
        watcher.logger = console.log
        informer.logging = true
    }
}

function putMetricData(MetricName, Value) {
    if (isMetric) {
        var params = {
            MetricData: [
                {
                    MetricName,
                    Value
                },
            ],
            Namespace: "AWS/Logs"
        };

        cw.putMetricData(params, function (err, data) {
            if (err) {
                console.error(`Error sending metric ${MetricName} (${Value}): ${JSON.stringify(err)}`)
            } else {
                if (verbose > 1) {
                    console.log(`Sent metric ${MetricName}: ${Value}`)
                }
            }
        })
    }
}

async function start() {
    // set up reporting
    watcher.on("productDeployed", informer.setDeployed.bind(informer))
    watcher.on("productUndeployed", informer.setUndeployed.bind(informer))
    watcher.on("productUpdated", informer.productUpdated.bind(informer))
    watcher.on("subscribed", informer.subscribe.bind(informer))

    // set up metrics
    watcher.on("event", event => {
        putMetricData(event.event, 1)
    })

    if (verbose > 1) {
        watcher.on("event", event => {
            console.log(`    Watcher detected event: ${JSON.stringify(event)}`)
        })
    }

    // write on disk how many blocks have been processed
    watcher.on("eventSuccessfullyProcessed", event => {
        fs.writeFile(logDir + "/lastBlock", event.blockNumber)
            .then(() => {
                if (verbose > 2) {
                    console.log(`Processed https://rinkeby.etherscan.io/block/${event.blockNumber}. Wrote ${logDir}/lastBlock.`)
                }
            })
    })

    // catch up the blocks that happened when we were gone
    let lastRecorded = 0
    try {
        lastRecorded = parseInt(await fs.readFile(logDir + "/lastBlock"))
    } catch (e) {
        // ignore error; if file is missing, start from zero
    }

    let lastActual = await web3.eth.getBlockNumber()
    while (lastRecorded < lastActual) {
        console.log(`Playing back blocks ${lastRecorded+1}...${lastActual} (inclusive)`)
        await watcher.playback(lastRecorded + 1, lastActual)
        await fs.writeFile(logDir + "/lastBlock", lastActual)
        lastRecorded = lastActual
        lastActual = await web3.eth.getBlockNumber()
    }
    putMetricData("PlaybackDone", 1)

    // report new blocks as they arrive
    console.log("Starting watcher...")
    watcher.start()

    return new Promise((done, fail) => {
        watcher.on("error", e => {
            // if it was because streamr backend couldn't find the product for set(Un)Deployed, just keep chugging
            if (e.code == "ECONNREFUSED") { return }

            fail(e)
        })
    })
}

start().catch(e => {
    console.error(e)

    process.exit(1)
})


putMetricData("Restart", 1)


