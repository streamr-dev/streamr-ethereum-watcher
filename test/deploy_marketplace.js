const Marketplace = require("../lib/marketplace-contracts/build/contracts/Marketplace.json")
const Token = require("../lib/marketplace-contracts/build/contracts/MintableToken.json")

module.exports = async web3 => {
    const accounts = await web3.eth.getAccounts()

    const tokenContract = new web3.eth.Contract(Token.abi)
    const tokenCons = tokenContract.deploy({
        data: Token.bytecode
    })

    console.log(await tokenCons.estimateGas())

    const token = await tokenCons.send({
        from: accounts[0]
    })

    return token

    const marketplace = await new web3.eth.Contract(Marketplace.abi).deploy({
        data: Marketplace.bytecode,
        arguments: [
            token.address
        ]
    }).send({
        from: accounts[0]
    })

    return marketplace
}
