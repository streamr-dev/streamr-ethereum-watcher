const argv = require("yargs").argv

const {marketplaceAddress, ethereumServerURL, streamrEngineURL, devopsKey} = argv

const Web3 = require("web3")
const web3 = new Web3(ethereumServerURL)

const Watcher = require("./src/watcher")
const watcher = new Watcher(web3, marketplaceAddress)

const Informer = require("./src/informer")
const informer = new Informer(streamrEngineURL, devopsKey)

watcher.on("productDeployed", informer.setDeployed)
watcher.on("productUndeployed", informer.setUndeployed)

log.debug("Starting watcher...")
watcher.start()