const ethers = require("ethers")

/** @typedef {String} EthereumAddress */

/**
 * Validate Ethereum contract addresses from user input
 * @returns {EthereumAddress} checksum-formatted by ethers.js
 **/
async function throwIfNotContract(eth, address) {
    let addr = null
    try {
        addr = ethers.utils.getAddress(address)
    } catch (e) {
        throw new Error(`Error: Bad Ethereum address ${address}`)
    }
    if (await eth.getCode(addr) === "0x") {
        throw new Error(`"Error: No contract at ${address}`)
    }
    return addr
}

module.exports = {
    throwIfNotContract,
}
