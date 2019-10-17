const sinon = require("sinon")
const assert = require("assert")

const {
    Wallet,
    providers: { Web3Provider },
    utils: { formatBytes32String, parseEther, parseUnits },
} = require("ethers")
const ganache = require("ganache-core")

const { Marketplace: { Currency } } = require("../lib/marketplace-contracts/src/contracts/enums")

const deploy = require("./deploy_marketplace")

const Watcher = require("../src/watcher")
describe("Watcher", () => {
    let watcher, provider

    let token, marketplace, wallet
    let token2, marketplace2, wallet2
    before(async function() {
        this.timeout(10000)
        const key1 = "0x1234567812345678123456781234567812345678123456781234567812345678"
        const key2 = "0x2234567812345678123456781234567812345678123456781234567812345679"
        provider = new Web3Provider(ganache.provider({
            accounts: [
                { secretKey: key1, balance: "0xffffffffffffffffffffffffff" },
                { secretKey: key2, balance: "0xffffffffffffffffffffffffff" },
            ],
            logger: console,
            blockTime: 0,
        }))
        provider.pollingInterval = 100
        wallet = new Wallet(key1, provider)
        await provider.getNetwork()     // wait until ganache is up and ethers.js ready

        ;({ token, marketplace } = await deploy(wallet))

        wallet2 = new Wallet(key2, provider)
        token2 = token.connect(wallet2)
        marketplace2 = marketplace.connect(wallet2)

        watcher = new Watcher(provider, marketplace.address)
        await watcher.start()
    })

    /**
     * After the last transaction but before checking watcher's handlers:
     *   wait until the callback is in fact called
     * TODO: find a better way
     */
    async function waitForWatcher() {
        const ms = provider.pollingInterval * 2 + 100
        return new Promise(resolve => {
            setTimeout(resolve, ms)
        })
    }

    // NOTE: tests inside this describe are not independently runnable!
    describe("real-time watcher", () => {
        const productIdString = "test-watcher"
        const productIdBytes32 = formatBytes32String(productIdString)
        const productId = productIdBytes32.slice(2)
        const price = parseEther("1")
        const price2 = parseEther("2")
        const scaledPrice = parseUnits("1", "gwei")
        const scaledPrice2 = parseUnits("2", "gwei").toString()

        it("catches product creation", async () => {
            const cb = sinon.spy()
            watcher.on("productDeployed", cb)
            const tx = await marketplace.createProduct(productIdBytes32, "Event tester", wallet.address, price, Currency.DATA, 1)
            await tx.wait(1)
            await waitForWatcher()
            assert.equal(cb.callCount, 1)
            assert.equal(cb.args[0][0], productId)
            assert.equal(cb.args[0][1].ownerAddress, wallet.address)
            assert.equal(cb.args[0][1].beneficiaryAddress, wallet.address)
            assert.equal(cb.args[0][1].minimumSubscriptionInSeconds, 1)
            assert.equal(cb.args[0][1].pricePerSecond, scaledPrice.toString())
            assert.equal(cb.args[0][1].priceCurrency, "DATA")
        }).timeout(10000)

        it("catches product deletion", async () => {
            const cb = sinon.spy()
            watcher.on("productUndeployed", cb)
            const tx = await marketplace.deleteProduct(productIdBytes32)
            await tx.wait(1)
            await waitForWatcher()
            assert.equal(cb.callCount, 1)
            assert.equal(cb.args[0][0], productId)
        }).timeout(10000)

        it("catches product re-deploy", async () => {
            const cb = sinon.spy()
            watcher.on("productDeployed", cb)
            const tx = await marketplace.redeployProduct(productIdBytes32)
            await tx.wait(1)
            await waitForWatcher()
            assert.equal(cb.callCount, 1)
            assert.equal(cb.args[0][0], productId)
            assert.equal(cb.args[0][1].ownerAddress, wallet.address)
            assert.equal(cb.args[0][1].beneficiaryAddress, wallet.address)
            assert.equal(cb.args[0][1].minimumSubscriptionInSeconds, 1)
            assert.equal(cb.args[0][1].pricePerSecond, scaledPrice.toString())
            assert.equal(cb.args[0][1].priceCurrency, "DATA")
        }).timeout(10000)

        // function updateProduct(bytes32 productId, string name, address beneficiary, uint pricePerSecond, Currency currency, uint minimumSubscriptionSeconds) public onlyProductOwner(productId) {
        it("catches product info update", async () => {
            const cb = sinon.spy()
            watcher.on("productUpdated", cb)
            const tx = await marketplace.updateProduct(productIdBytes32, "Muh produx111!", wallet2.address, price2, Currency.DATA, 10)
            await tx.wait(1)
            await waitForWatcher()
            assert.equal(cb.callCount, 1)
            assert.equal(cb.args[0][0], productId)
            assert.equal(cb.args[0][1].ownerAddress, wallet.address)
            assert.equal(cb.args[0][1].beneficiaryAddress, wallet2.address)
            assert.equal(cb.args[0][1].minimumSubscriptionInSeconds, 10)
            assert.equal(cb.args[0][1].pricePerSecond, scaledPrice2.toString())
            assert.equal(cb.args[0][1].priceCurrency, "DATA")
            watcher.removeListener("productUpdated", cb)
        }).timeout(10000)

        it("catches product ownership change", async () => {
            const cb = sinon.spy()
            watcher.on("productUpdated", cb)
            const tx1 = await marketplace.offerProductOwnership(productIdBytes32, wallet2.address)
            await tx1.wait(1)
            const tx2 = await marketplace2.claimProductOwnership(productIdBytes32)
            await tx2.wait(1)
            await waitForWatcher()
            assert.equal(cb.callCount, 1)
            assert.equal(cb.args[0][0], productId)
            assert.equal(cb.args[0][1].ownerAddress, wallet2.address)
            assert.equal(cb.args[0][1].beneficiaryAddress, wallet2.address)
            assert.equal(cb.args[0][1].minimumSubscriptionInSeconds, 10)
            assert.equal(cb.args[0][1].pricePerSecond, scaledPrice2.toString())
            assert.equal(cb.args[0][1].priceCurrency, "DATA")
        }).timeout(10000)

        it("catches subscription", async () => {
            const cb = sinon.spy()
            watcher.on("subscribed", cb)
            const tx1 = await token.mint(wallet.address, parseEther("1000"))
            await tx1.wait(1)
            const tx2 = await token.approve(marketplace.address, parseEther("1000"))
            await tx2.wait(1)
            const tx3 = await marketplace.buy(productIdBytes32, 100)
            await tx3.wait(1)
            await waitForWatcher()
            assert.equal(cb.callCount, 1)
            assert.equal(cb.args[0][0].product, productId)
            assert.equal(cb.args[0][0].address, wallet.address)
            const diff = cb.args[0][0].endsAt - Date.now() / 1000
            assert(diff < 101)
            assert(diff > 90)
        }).timeout(10000)
    })

    describe("playback", () => {
        const id1 = formatBytes32String("first-test-id")
        const id2 = formatBytes32String("second-test-id")
        it("catches product creation/deletion/redeploy/update/buy", async () => {
            const cb = sinon.spy()
            watcher.on("productDeployed", cb)

            const tx1 = await marketplace.createProduct(id1, "playback-test", wallet.address, parseEther("1"), Currency.DATA, 1) // -> productDeployed
            const tr1 = await tx1.wait(1)
            assert.deepStrictEqual(tr1.events.map(e => e.event), ["ProductCreated"])
            const tx2 = await marketplace.deleteProduct(id1) // -> productUndeployed
            const tr2 = await tx2.wait(1)
            assert.deepStrictEqual(tr2.events.map(e => e.event), ["ProductDeleted"])
            const tx3 = await marketplace.redeployProduct(id1) // -> productDeployed
            const tr3 = await tx3.wait(1)
            assert.deepStrictEqual(tr3.events.map(e => e.event), ["ProductRedeployed"])
            const tx4 = await token.mint(wallet2.address, parseEther("1000"))
            const tr4 = await tx4.wait(1)
            assert.deepStrictEqual(tr4.events.map(e => e.event), ["Mint", "Transfer"])
            const tx5 = await token2.approve(marketplace.address, parseEther("1000"))
            const tr5 = await tx5.wait(1)
            assert.deepStrictEqual(tr5.events.map(e => e.event), ["Approval"])
            const tx6 = await marketplace2.buy(id1, 100) // -> subscribed
            const tr6 = await tx6.wait(1)
            assert.deepStrictEqual(tr6.events.map(e => e.event), ["NewSubscription", "Subscribed", undefined])  // 3rd event is token.Transfer
            const tx7 = await marketplace2.buy(id1, 200) // -> subscribed
            const tr7 = await tx7.wait(1)
            assert.deepStrictEqual(tr7.events.map(e => e.event), ["SubscriptionExtended", "Subscribed", undefined])  // 3rd event is token.Transfer
            const tx8 = await marketplace.updateProduct(id1, "updated-name", wallet.address, parseEther("2"), Currency.DATA, 10) // -> productUpdated
            const tr8 = await tx8.wait(1)
            assert.deepStrictEqual(tr8.events.map(e => e.event), ["ProductUpdated"])
            const tx9 = await marketplace.createProduct(id2, "playback-test-end", wallet.address, parseEther("1"), Currency.DATA, 1) // -> productDeployed
            const tr9 = await tx9.wait(1)
            assert.deepStrictEqual(tr9.events.map(e => e.event), ["ProductCreated"])
            await waitForWatcher()

            const from = cb.args[0][1].blockNumber
            const to = cb.args[2][1].blockNumber

            const deployed = sinon.spy()
            const undeployed = sinon.spy()
            const subscribe = sinon.spy()
            const updated = sinon.spy()
            watcher.on("productDeployed", deployed)
            watcher.on("productUndeployed", undeployed)
            watcher.on("productUpdated", updated)
            watcher.on("subscribed", subscribe)
            await watcher.playback(from, to)
            assert.equal(deployed.callCount, 3)
            assert.equal(undeployed.callCount, 1)
            assert.equal(updated.callCount, 1)
            assert.equal(subscribe.callCount, 2)
        }).timeout(60000)
    })
})
