const ethers = require("ethers")

/** @typedef {String} EthereumAddress */

/**
 * Validate Ethereum contract addresses from user input
 * @returns {Maybe<EthereumAddress>} checksum-formatted by ethers.js, or null if not set
 **/
async function throwIfSetButNotContract(eth, address, variableDescription) {
    if (!address) { return }
    return throwIfNotContract(eth, address, variableDescription)
}

/**
 * Validate Ethereum contract addresses from user input
 * @returns {EthereumAddress} checksum-formatted by ethers.js
 **/
async function throwIfNotContract(eth, address, variableDescription) {
    const addr = throwIfBadAddress(address, variableDescription)
    if (await eth.getCode(address) === "0x") {
        throw new Error(`${variableDescription || "Error"}: No contract at ${address}`)
    }
    return addr
}

/**
 * Validate addresses from user input
 * @returns {Maybe<EthereumAddress>} checksum-formatted by ethers.js, or null if not set
 **/
function throwIfSetButBadAddress(address, variableDescription) {
    if (!address) { return null }
    return throwIfBadAddress(address, variableDescription)
}

/**
 * Validate addresses from user input
 * @returns {EthereumAddress} checksum-formatted by ethers.js
 **/
function throwIfBadAddress(address, variableDescription) {
    try {
        return ethers.utils.getAddress(address)
    } catch (e) {
        throw new Error(`${variableDescription || "Error"}: Bad Ethereum address ${address}`)
    }
}

function throwIfNotSet(variable, description) {
    if (typeof variable === "undefined") {
        throw new Error(`${description || "Error"}: Expected a value!`)
    }
    return variable
}

module.exports = {
    throwIfNotContract,
    throwIfSetButNotContract,
    throwIfBadAddress,
    throwIfSetButBadAddress,
    throwIfNotSet,
}
