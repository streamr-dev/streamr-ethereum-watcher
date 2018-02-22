const Marketplace = require("../lib/marketplace-contracts/build/contracts/Marketplace.json")
const Token = require("../lib/marketplace-contracts/build/contracts/MintableToken.json")

module.exports = async web3 => {
    const token = await new web3.eth.Contract(Token.abi).deploy({
        data: token.bytecode
    }).send()

    const marketplace = await new web3.eth.Contract(Marketplace.abi).deploy({
        data: marketplace.bytecode,
        arguments: [
            token.address
        ]
    }).send()

    return marketplace
}
