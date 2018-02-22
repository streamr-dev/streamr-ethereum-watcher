const argv = require("yargs").argv

const {marketplaceAddress, ethereumServerURL} = argv

const Web3 = require("web3")
const web3 = new Web3(ethereumServerURL)

