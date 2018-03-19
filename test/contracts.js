const web3 = require("./init_web3")()     // test-local testrpc (default)
//const web3 = require("./init_web3")("ws://127.0.0.1:8546")    // local client (parity/geth/testrpc from shell)
//const web3 = require("./init_web3")("wss://rinkeby.infura.io/ws")

const { Marketplace: { ProductState, Currency } } = require("../lib/marketplace-contracts/src/contracts/enums")

const { sendFrom } = require("../src/utils")

// Just test the underlying contracts, to see they really work like we expect
// If submodule changes, this test might catch violated assumptions in this project
describe("Contracts", () => {
    it("create + subscribe", async () => {
        const accounts = await web3.eth.getAccounts()

        const Marketplace = require("../lib/marketplace-contracts/build/contracts/Marketplace.json")
        const Token = require("../lib/marketplace-contracts/build/contracts/MintableToken.json")

        const token = await sendFrom(accounts[0], new web3.eth.Contract(Token.abi).deploy({ data: Token.bytecode, arguments: [] }))
        const marketplace = await sendFrom(accounts[0], new web3.eth.Contract(Marketplace.abi).deploy({ data: Marketplace.bytecode, arguments: [
            token.options.address,
            accounts[0]     // currencyUpdateAgent
        ]}))

        const productId = "test-e2e"
        const productIdHex = web3.utils.fromUtf8(productId)
        const productIdBytes = productIdHex.slice(2).padEnd(64, "0")

        const verbose = true

        await sendFrom(accounts[0], marketplace.methods.createProduct(productIdHex, "End-to-end tester", accounts[3], 1, Currency.DATA, 1))
        await sendFrom(accounts[0], token.methods.mint(accounts[1], 100000), {verbose})
        await sendFrom(accounts[1], token.methods.approve(marketplace.options.address, 10000), {verbose})
        await sendFrom(accounts[1], marketplace.methods.buy(productIdHex, 100), {verbose})
    })
})