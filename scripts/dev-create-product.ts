import IMarketplaceJson from "../artifacts/contracts/IMarketplace.sol/IMarketplace.json"
import { IMarketplace } from "../typechain/IMarketplace"

import { Chains } from "@streamr/config"
import { Contract, providers, Wallet } from "ethers";
const { log } = console

const productId = process.argv[2] || "0x0000000000000000000000000000000000000000000000000000000000000001"

const {
    ethereum: {
        rpcEndpoints: [{
            url: rpcUrl,
        }],
        contracts: {
            "Marketplace": marketplaceAddress
        }
    }
} = Chains.load("development")

const provider = new providers.JsonRpcProvider(rpcUrl)
const key = "0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0"
const wallet = new Wallet(key, provider)

// function createProduct(
//     bytes32 id,
//     string memory name,
//     address beneficiary,
//     uint pricePerSecond,
//     Currency currency,
//     uint minimumSubscriptionSeconds
// ) external;
const args = [
    productId,
    "test-product",
    wallet.address,
    "10",
    "0",
    "10"
]

async function main() {
    const market = new Contract(marketplaceAddress, IMarketplaceJson.abi, wallet) as IMarketplace
    // @ts-expect-error can't bother type those args
    const tx = await market.createProduct(...args)
    log("Sending createProduct tx with args %o", args)
    const tr = await tx.wait()
    log("Transaction receipt: %o", tr)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
