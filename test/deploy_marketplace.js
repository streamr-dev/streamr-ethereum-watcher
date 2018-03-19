const Marketplace = require("../lib/marketplace-contracts/build/contracts/Marketplace.json")
const Token = require("../lib/marketplace-contracts/build/contracts/MintableToken.json")

const { sendFrom } = require("../src/utils")

module.exports = async web3 => {
    const accounts = await web3.eth.getAccounts()

    const token = await sendFrom(accounts[0], new web3.eth.Contract(Token.abi).deploy({ data: Token.bytecode, arguments: [] }))
    const marketplace = await sendFrom(accounts[0], new web3.eth.Contract(Marketplace.abi).deploy({ data: Marketplace.bytecode, arguments: [
        token.options.address,
        accounts[0]     // currencyUpdateAgent
    ]}))

    return {token, marketplace}
}
