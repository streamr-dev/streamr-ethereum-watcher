import {ethers} from "ethers"
import OldMarketplace from "../lib/marketplace-contracts/build/contracts/OldMarketplace.json"
import Marketplace from "../lib/marketplace-contracts/build/contracts/Marketplace.json"
import Token from "../lib/marketplace-contracts/build/contracts/MintableToken.json"

export async function deploy(wallet: ethers.Wallet): Promise<any> {
    const tokenDeployer = new ethers.ContractFactory(Token.abi, Token.bytecode, wallet)
    const token = await tokenDeployer.deploy()
    await token.deployed()

    const oldMarketDeployer = new ethers.ContractFactory(OldMarketplace.abi, OldMarketplace.bytecode, wallet)
    const oldMarketplace = await oldMarketDeployer.deploy(token.address, wallet.address)
    await oldMarketplace.deployed()

    const marketDeployer = new ethers.ContractFactory(Marketplace.abi, Marketplace.bytecode, wallet)
    const marketplace = await marketDeployer.deploy(token.address, wallet.address, oldMarketplace.address)
    await marketplace.deployed()

    return Promise.resolve({token, marketplace})
}
