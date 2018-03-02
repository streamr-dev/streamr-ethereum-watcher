const sinon = require("sinon")
const delay = require("timeout-as-promise")

const web3 = require("./init_web3")()//"ws://localhost:8545")
const Watcher = require("../src/watcher")
const Informer = require("../src/informer")

const { Marketplace: { ProductState, Currency } } = require("../lib/marketplace-contracts/src/contracts/enums")

const { sendFrom } = require("../src/utils")

describe("Watcher", () => {
    let watcher
    let informer = sinon.mock(Informer.prototype)

    let token, marketplace, accounts
    before(async () => {
        ({token, marketplace} = await require("./deploy_marketplace")(web3))
        accounts = await web3.eth.getAccounts()
        watcher = new Watcher(web3, marketplace.options.address)
    })

    it("catches product creation", async () => {
        const productId = "test"
        informer.expects("setDeployed").once().withArgs(productId)

        const lol = web3
        watcher.start()
        await sendFrom(accounts[0], marketplace.methods.createProduct(web3.utils.fromUtf8(productId), "test", accounts[0], 1, Currency.DATA, 1))

        await delay(1000)
        informer.verify()
    })
})
