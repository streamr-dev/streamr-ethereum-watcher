// for manual testing: purchase a product on marketplace
// Usage:
//    start docker environment if you haven't already ;)
//    first set watcher running (src/main.ts)
//    then run scripts/create_stream_product.ts
//    then change the productIdBytes below (keep the 0x prefix!)
//    then run this

const productIdBytes = "0xf640d5322ae246ac8abc19e722c8c26dd5b8a53ea36848e7b6e8fff1f121b58e"

import { Contract, Wallet, providers, BigNumber, utils } from "ethers"

import IMarketplaceJson from "../artifacts/contracts/IMarketplace.sol/IMarketplace.json"
import { IMarketplace } from "../typechain/IMarketplace"

import DATAv2json from "../artifacts/contracts/token/DATAv2.sol/DATAv2.json"
import { DATAv2 } from "../typechain/DATAv2"

const { JsonRpcProvider } = providers
const { parseEther } = utils
const { log } = console

import { Chains } from "@streamr/config"

const {
    ethereum: {
        rpcEndpoints: [{
            url: ETHEREUM_SERVER_URL,
        }],
        contracts: {
            "DATA-token": dataTokenAddress,
            "Marketplace": MARKETPLACE_ADDRESS,
        }
    }
} = Chains.load("development")

const adminKey = "0x5e98cce00cff5dea6b454889f359a4ec06b9fa6b88e9d69b86de8e1c81887da0" // 0xa3d1f77acff0060f7213d7bf3c7fec78df847de1
const prefundedKey = "0xe5af7834455b7239881b85be89d905d6881dcb4751063897f12be1b0dd546bdb"

const provider = new JsonRpcProvider(ETHEREUM_SERVER_URL)
const wallet = new Wallet(prefundedKey, provider)
const adminWallet = new Wallet(adminKey, provider)

const token = new Contract(dataTokenAddress, DATAv2json.abi, adminWallet) as DATAv2
const market = new Contract(MARKETPLACE_ADDRESS, IMarketplaceJson.abi, wallet) as IMarketplace

async function main() {
    if (BigNumber.from("0").eq(await token.allowance(wallet.address, market.address))) {
        log("Minting tokens")
        const mintTx = await token.mint(wallet.address, parseEther("10000"))
        await mintTx.wait()
        log("Adding approval")
        const approveTx = await token.connect(wallet).approve(market.address, parseEther("100"))
        await approveTx.wait()
    }

    const buyTx = await market.buy(productIdBytes, "10")
    log("Sending market.buy(%s, %s) from %s", productIdBytes, "10", wallet.address)
    const buyTr = await buyTx.wait()
    console.log("Events: %o", buyTr.events)
}
main().catch(console.error)
