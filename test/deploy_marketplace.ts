import {ethers} from "ethers"
const Token = require("../lib/marketplace-contracts/build/contracts/MintableToken.json")
const OldMarketplace = require("../lib/marketplace-contracts/build/contracts/OldMarketplace.json")
const Marketplace = require("../lib/marketplace-contracts/build/contracts/Marketplace.json")

class TokenAndMarketplace {
    constructor(
        readonly token: ethers.Contract,
        readonly marketplace: ethers.Contract) {
    }
}

async function deploy(wallet: ethers.Wallet): Promise<TokenAndMarketplace> {
    const tokenDeployer = new ethers.ContractFactory(Token.abi, Token.bytecode, wallet)
    const token = await tokenDeployer.deploy()
    await token.deployed()

    const oldMarketDeployer = new ethers.ContractFactory(OldMarketplace.abi, OldMarketplace.bytecode, wallet)
    const oldMarketplace = await oldMarketDeployer.deploy(token.address, wallet.address)
    await oldMarketplace.deployed()

    const marketDeployer = new ethers.ContractFactory(Marketplace.abi, Marketplace.bytecode, wallet)
    const marketplace = await marketDeployer.deploy(token.address, wallet.address, oldMarketplace.address)
    await marketplace.deployed()

    return Promise.resolve(new TokenAndMarketplace(token, marketplace))
}

export {
    TokenAndMarketplace,
    deploy,
}
