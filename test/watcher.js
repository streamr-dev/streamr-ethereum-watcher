const sinon = require("sinon")
const assert = require("assert")

const web3 = require("./init_web3")()//("ws://127.0.0.1:7545")
const Watcher = require("../src/watcher")

const { Marketplace: { ProductState, Currency } } = require("../lib/marketplace-contracts/src/contracts/enums")

const { sendFrom } = require("../src/utils")

describe("Watcher", () => {
    let watcher

    const productId = "test"
    const productIdHex = web3.utils.fromUtf8(productId)

    let token, marketplace, accounts
    before(async () => {
        ({token, marketplace} = await require("./deploy_marketplace")(web3))
        accounts = await web3.eth.getAccounts()
        watcher = new Watcher(web3, marketplace.options.address)
        watcher.start()
    })

    it("catches product creation", async () => {
        const cb = sinon.spy()
        watcher.on("productDeployed", cb)
        await sendFrom(accounts[0], marketplace.methods.createProduct(productIdHex, "test", accounts[0], 1, Currency.DATA, 1))
        assert.equal(cb.callCount, 1)
        assert.equal(cb.args[0][0], productId)
        assert.equal(cb.args[0][1].ownerAddress, accounts[0])
        assert.equal(cb.args[0][1].beneficiaryAddress, accounts[0])
        assert.equal(cb.args[0][1].minimumSubscriptionInSeconds, 1)
        assert.equal(cb.args[0][1].pricePerSecond, 1)
        assert.equal(cb.args[0][1].priceCurrency, "DATA")
    })

    it("catches product deletion", async () => {
        const productId = "test"
        const cb = sinon.spy()
        watcher.on("productUndeployed", cb)
        const res = await sendFrom(accounts[0], marketplace.methods.deleteProduct(productIdHex))
        assert.equal(cb.callCount, 1)
        assert.equal(cb.args[0][0], productId)
    })

    it("catches product re-deploy", async () => {
        const cb = sinon.spy()
        watcher.on("productDeployed", cb)
        await sendFrom(accounts[0], marketplace.methods.redeployProduct(productIdHex))
        assert.equal(cb.callCount, 1)
        assert.equal(cb.args[0][0], productId)
        assert.equal(cb.args[0][1].ownerAddress, accounts[0])
        assert.equal(cb.args[0][1].beneficiaryAddress, accounts[0])
        assert.equal(cb.args[0][1].minimumSubscriptionInSeconds, 1)
        assert.equal(cb.args[0][1].pricePerSecond, 1)
        assert.equal(cb.args[0][1].priceCurrency, "DATA")
    })
})
