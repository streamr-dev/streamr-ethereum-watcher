import {ethers} from "ethers"

/**
 * Validate Ethereum contract addresses from user input
 * @param provider Ethers Provider instance
 * @param address Ethereum address to validate
 * @returns Promise<string> ethereum address checksum-formatted by ethers.js
 **/
export async function throwIfNotContract(provider: ethers.providers.Provider, address: string): Promise<string> {
    let addr: string
    try {
        addr = ethers.utils.getAddress(address)
    } catch (e) {
        return Promise.reject(`Error: Bad Ethereum address ${address}`)
    }
    if (await provider.getCode(addr) === "0x") {
        return Promise.reject(`"Error: No contract at ${address}`)
    }
    return Promise.resolve(addr)
}
