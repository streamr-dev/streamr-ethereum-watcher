const sinon = require("sinon")
const assert = require("assert")

const web3 = require("./init_web3")()     // test-local testrpc (default)
//const web3 = require("./init_web3")("ws://127.0.0.1:8546")    // local client (parity/geth/testrpc from shell)
//const web3 = require("./init_web3")("wss://rinkeby.infura.io/ws")
const Watcher = require("../src/watcher")

const { Marketplace: { ProductState, Currency } } = require("../lib/marketplace-contracts/src/contracts/enums")

const { sendFrom } = require("../src/utils")

describe("Watcher", () => {
    let watcher

    let token, marketplace, accounts
    before(async () => {
        ({token, marketplace} = await require("./deploy_marketplace")(web3))
        accounts = await web3.eth.getAccounts()
        watcher = new Watcher(web3, marketplace.options.address)
        watcher.start()
    })

    describe("real-time watcher", () => {
        const productId = "test-events"
        const productIdHex = web3.utils.fromUtf8(productId)
        const productIdBytes = productIdHex.slice(2).padEnd(64, "0")

        it("catches product creation", async () => {
            const cb = sinon.spy()
            watcher.on("productDeployed", cb)
            await sendFrom(accounts[0], marketplace.methods.createProduct(productIdHex, "Event tester", accounts[3], 1, Currency.DATA, 1))
            assert.equal(cb.callCount, 1)
            assert.equal(cb.args[0][0], productIdBytes)
            assert.equal(cb.args[0][1].ownerAddress, accounts[0])
            assert.equal(cb.args[0][1].beneficiaryAddress, accounts[3])
            assert.equal(cb.args[0][1].minimumSubscriptionInSeconds, 1)
            assert.equal(cb.args[0][1].pricePerSecond, 1)
            assert.equal(cb.args[0][1].priceCurrency, "DATA")
        })

        it("catches product deletion", async () => {
            const cb = sinon.spy()
            watcher.on("productUndeployed", cb)
            await sendFrom(accounts[0], marketplace.methods.deleteProduct(productIdHex))
            assert.equal(cb.callCount, 1)
            assert.equal(cb.args[0][0], productIdBytes)
        })

        it("catches product re-deploy", async () => {
            const cb = sinon.spy()
            watcher.on("productDeployed", cb)
            await sendFrom(accounts[0], marketplace.methods.redeployProduct(productIdHex))
            assert.equal(cb.callCount, 1)
            assert.equal(cb.args[0][0], productIdBytes)
            assert.equal(cb.args[0][1].ownerAddress, accounts[0])
            assert.equal(cb.args[0][1].beneficiaryAddress, accounts[3])
            assert.equal(cb.args[0][1].minimumSubscriptionInSeconds, 1)
            assert.equal(cb.args[0][1].pricePerSecond, 1)
            assert.equal(cb.args[0][1].priceCurrency, "DATA")
        })

        it("catches subscription", async () => {
            const cb = sinon.spy()
            watcher.on("subscribed", cb)
            const verbose = true
            await sendFrom(accounts[0], token.methods.mint(accounts[1], 100000))
            await sendFrom(accounts[1], token.methods.approve(marketplace.options.address, 10000))
            await sendFrom(accounts[1], marketplace.methods.buy(productIdHex, 100))
            assert.equal(cb.callCount, 1)
            assert.equal(cb.args[0][0].product, productIdBytes)
            assert.equal(cb.args[0][0].address, accounts[1])
            console.log("endsAt: " + cb.args[0][0].endsAt)
            console.log("now: " + (+new Date()))
        })

    })

    describe("playback", () => {
        it("catches product creation/deletion/redeploy/buy", async () => {
            const cb = sinon.spy()
            watcher.on("productDeployed", cb)
            await sendFrom(accounts[0], marketplace.methods.createProduct("0x1234", "playback-test", accounts[0], 1, Currency.DATA, 1))
            await sendFrom(accounts[0], marketplace.methods.deleteProduct("0x1234"))
            await sendFrom(accounts[0], marketplace.methods.redeployProduct("0x1234"))
            await sendFrom(accounts[0], token.methods.mint(accounts[1], 100000))
            await sendFrom(accounts[1], token.methods.approve(marketplace.options.address, 10000))
            await sendFrom(accounts[1], marketplace.methods.buy("0x1234", 100))
            await sendFrom(accounts[1], marketplace.methods.buy("0x1234", 200))
            await sendFrom(accounts[0], marketplace.methods.createProduct("0x2345", "playback-test2", accounts[0], 1, Currency.DATA, 1))
            const from = cb.args[0][1].blockNumber
            const to = cb.args[2][1].blockNumber

            const deployed = sinon.spy()
            const undeployed = sinon.spy()
            const subscribe = sinon.spy()
            watcher.on("productDeployed", deployed)
            watcher.on("productUndeployed", undeployed)
            watcher.on("subscribed", subscribe)
            await watcher.playback(from, to)
            assert.equal(deployed.callCount, 3)
            assert.equal(undeployed.callCount, 1)
            assert.equal(subscribe.callCount, 2)
        })
    })
})
