const ethers = require("ethers")

/**
 * Validate Ethereum contract addresses from user input
 * @param provider Ethers Provider instance
 * @param address Ethereum address to validate
 * @returns {string} ethereum address checksum-formatted by ethers.js
 **/
async function throwIfNotContract(provider, address) {
    let addr = null
    try {
        addr = ethers.utils.getAddress(address)
    } catch (e) {
        throw new Error(`Error: Bad Ethereum address ${address}`)
    }
    if (await provider.getCode(addr) === "0x") {
        throw new Error(`"Error: No contract at ${address}`)
    }
    return addr
}

module.exports = {
    throwIfNotContract,
}
