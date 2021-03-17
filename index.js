// for persisting last processed block (to avoid full playback every restart)
const fs = require("fs")

// Setting up CloudWatch service object, borrowed from https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/cloudwatch-examples-getting-metrics.html
const AWS = require("aws-sdk")
AWS.config.update({region: "eu-west-1"})
const cw = new AWS.CloudWatch({apiVersion: "2010-08-01"})

const argv = require("yargs").argv
const {
    old,
    marketplaceAddress,
    networkId,
    ethereumServerURL,
    streamrApiURL,
    devopsKey,
    verbose,
    metrics,
    logDir = "logs"     // also where the persisted program state (lastBlock) lives
} = argv

const { throwIfNotContract } = require("./src/checkArguments")

const {
    getDefaultProvider,
    providers: { JsonRpcProvider }
} = require("ethers")

const Marketplace = old ?
    require("./lib/marketplace-contracts/build/contracts/OldMarketplace.json") :
    require("./lib/marketplace-contracts/build/contracts/Marketplace.json")

const { log, error } = console

async function start() {
    const provider =
        ethereumServerURL ? new JsonRpcProvider(ethereumServerURL) :
        networkId ? getDefaultProvider(networkId) : null
    if (!provider) { throw new Error("missing --ethereumServerURL or --networkId!") }

    const network = await provider.getNetwork().catch(e => {
        throw new Error(`Connecting to Ethereum failed, --networkId=${networkId} --ethereumServerURL=${ethereumServerURL}`, e)
    })
    log("Connected to Ethereum network: ", JSON.stringify(network))

    // deployed using truffle, mainnet tx: https://etherscan.io/tx/0x868a6604e6c33ebc52a3fe5d020d970fdd0019e8eb595232599d67f91624d877
    const deployedMarketplaceAddress = Marketplace.networks[networkId] && Marketplace.networks[networkId].address

    const addr = marketplaceAddress || deployedMarketplaceAddress
    if (!addr) { throw new Error("Requires --marketplaceAddress or --networkId one of " + Object.keys(Marketplace.networks).join(", ")) }
    const marketAddress = await throwIfNotContract(provider, marketplaceAddress || deployedMarketplaceAddress)

    const Watcher = require("./src/watcher")
    const watcher = new Watcher(provider, marketAddress, old)

    const Informer = require("./src/informer")
    const informer = new Informer(streamrApiURL, devopsKey)

    if (verbose) {
        watcher.on("productDeployed", (id, body) => { log(`Product ${id} deployed ${JSON.stringify(body)}`) })
        watcher.on("productUndeployed", (id, body) => { log(`Product ${id} UNdeployed ${JSON.stringify(body)}`) })
        watcher.on("productUpdated", (id, body) => { log(`Product ${id} UPDATED ${JSON.stringify(body)}`) })
        watcher.on("subscribed", (body) => { log(`Product ${body.product} subscribed ${JSON.stringify(body)}`) })
        if (verbose > 1) {
            watcher.logger = (...args) => { log(" Watcher >", ...args) }
            informer.logger = (...args) => { log(" watcher/Informer >", ...args) }
            watcher.on("event", event => {
                log(`    Watcher detected event: ${JSON.stringify(event)}`)
            })
        }
    }
    await watcher.checkMarketplaceAddress()

    // set up reporting
    watcher.on("productDeployed", informer.setDeployed.bind(informer))
    watcher.on("productUndeployed", informer.setUndeployed.bind(informer))
    watcher.on("productUpdated", informer.productUpdated.bind(informer))
    watcher.on("subscribed", informer.subscribe.bind(informer))

    // set up metrics
    watcher.on("event", event => {
        putMetricData(event.event, 1)
    })

    // write on disk how many blocks have been processed
    watcher.on("eventSuccessfullyProcessed", event => {
        fs.writeFile(logDir + "/lastBlock", event.blockNumber.toString(), error => {
            if (error) { throw error }
            if (verbose > 2) {
                log(`Processed https://etherscan.io/block/${event.blockNumber}. Wrote ${logDir}/lastBlock.`)
            }
        })
    })

    // catch up the blocks that happened when we were gone
    let lastRecorded = 0
    try {
        lastRecorded = parseInt(fs.readFileSync(logDir + "/lastBlock"))
    } catch (e) {
        // ignore error; if file is missing, start from zero
    }

    let lastActual = await provider.getBlockNumber()
    while (lastRecorded < lastActual) {
        log(`Playing back blocks ${lastRecorded + 1}...${lastActual} (inclusive)`)
        await watcher.playback(lastRecorded + 1, lastActual)
        fs.writeFileSync(logDir + "/lastBlock", lastActual.toString())
        lastRecorded = lastActual
        lastActual = await provider.getBlockNumber()
    }
    putMetricData("PlaybackDone", 1)

    // report new blocks as they arrive
    log("Starting watcher...")
    await watcher.start()

    return new Promise((done, fail) => {
        watcher.on("error", e => {
            // if it was because streamr backend couldn't find the product for set(Un)Deployed, just keep chugging
            if (e.code == "ECONNREFUSED") { return }

            fail(e)
        })
    })
}

function putMetricData(MetricName, Value) {
    if (metrics) {
        var params = {
            MetricData: [
                {
                    MetricName,
                    Value
                },
            ],
            Namespace: "AWS/Logs"
        }

        cw.putMetricData(params, function (err, data) {
            if (err) {
                error(`Error sending metric ${MetricName} (${Value}): ${JSON.stringify(err)}`)
            } else {
                if (verbose > 1) {
                    log(`Sent metric ${MetricName}: ${Value}`)
                    log("Got back " + JSON.stringify(data))
                }
            }
        })
    }
}

start().catch(e => {
    error(e.stack)
    process.exit(1)
})

putMetricData("Restart", 1)
