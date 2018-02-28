const Marketplace = require("../lib/marketplace-contracts/build/contracts/Marketplace.json")
const Token = require("../lib/marketplace-contracts/build/contracts/MintableToken.json")

module.exports = async web3 => {
    const accounts = await web3.eth.getAccounts()

    /**
     * Deploy helper. VERY surprisingly and unlike pre-1.0, web3 doesn't seem to automagically calculate the gas limit
     * @param abi
     * @param data
     * @param arguments (optional)
     * @returns {Promise<Contract>}
     */
    async function deploy(abi, data, arguments) {
        const contract = new web3.eth.Contract(abi)
        const deployTx = contract.deploy({ data, arguments })
        return deployTx.send({
            from: accounts[0],
            gas: await deployTx.estimateGas()
        })
    }

    const token = deploy(Token.abi, Token.bytecode, [])
    const marketplace = deploy(Marketplace.abi, Marketplace.bytecode, [
        token.address,
        accounts[0]     // currencyUpdateAgent
    ])

    return {token, marketplace}
}
