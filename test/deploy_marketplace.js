const {
    ContractFactory,
} = require("ethers")

const Marketplace = require("../lib/marketplace-contracts/build/contracts/Marketplace.json")
const Token = require("../lib/marketplace-contracts/build/contracts/MintableToken.json")

module.exports = async wallet => {
    const tokenDeployer = new ContractFactory(Token.abi, Token.bytecode, wallet)
    const token = await tokenDeployer.deploy()
    await token.deployed()

    const marketDeployer = new ContractFactory(Marketplace.abi, Marketplace.bytecode, wallet)
    const marketplace = await marketDeployer.deploy(token.address, wallet.address)
    await marketplace.deployed()

    return { token, marketplace }
}
