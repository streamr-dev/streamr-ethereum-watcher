const ethers = require("ethers")

/** @typedef {String} EthereumAddress */

/**
 * Validate Ethereum contract addresses from user input
 * @returns {EthereumAddress} checksum-formatted by ethers.js
 **/
async function throwIfNotContract(eth, address) {
    const addr = throwIfBadAddress(address)
    if (await eth.getCode(address) === "0x") {
        throw new Error(`"Error: No contract at ${address}`)
    }
    return addr
}
/**
 * Validate addresses from user input
 * @returns {EthereumAddress} checksum-formatted by ethers.js
 **/
function throwIfBadAddress(address) {
    try {
        return ethers.utils.getAddress(address)
    } catch (e) {
        throw new Error(`Error: Bad Ethereum address ${address}`)
    }
}

module.exports = {
    throwIfNotContract,
}
