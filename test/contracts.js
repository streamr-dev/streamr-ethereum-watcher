const assert = require("assert")

const {
    Wallet,
    providers: { Web3Provider },
    utils: { formatBytes32String },
} = require("ethers")
const ganache = require("ganache-core")

const { Marketplace: { Currency } } = require("../lib/marketplace-contracts/src/contracts/enums")

const deploy = require("./deploy_marketplace")

// Just test the underlying contracts, to see they really work like we expect
// If submodule changes, this test might catch violated assumptions in this project
describe("Contracts", () => {
    it("create product + subscribe", async function() {
        this.timeout(10000)
        const key1 = "0x1234567812345678123456781234567812345678123456781234567812345678"
        const key2 = "0x2234567812345678123456781234567812345678123456781234567812345679"
        const provider = new Web3Provider(ganache.provider({
            accounts: [
                { secretKey: key1, balance: "0xffffffffffffffffffffffffff" },
                { secretKey: key2, balance: "0xffffffffffffffffffffffffff" },
            ],
            logger: console,
        }))
        const wallet = new Wallet(key1, provider)
        await provider.getNetwork()     // wait until ganache is up and ethers.js ready

        const { token, marketplace } = await deploy(wallet)

        const wallet2 = new Wallet(key2, provider)
        const token2 = token.connect(wallet2)
        const marketplace2 = marketplace.connect(wallet2)

        const productId = "test-contracts"
        const productIdBytes32 = formatBytes32String(productId)

        const tx1 = await marketplace.createProduct(productIdBytes32, "Contract tester", wallet.address, 1, Currency.DATA, 1)
        const tr1 = await tx1.wait(0)
        assert.deepStrictEqual(tr1.events.map(e => e.event), ["ProductCreated"])
        const tx2 = await token.mint(wallet2.address, 100000)
        const tr2 = await tx2.wait(0)
        assert.deepStrictEqual(tr2.events.map(e => e.event), ["Mint", "Transfer"])
        const tx3 = await token2.approve(marketplace.address, 10000)
        const tr3 = await tx3.wait(0)
        assert.deepStrictEqual(tr3.events.map(e => e.event), ["Approval"])
        const tx4 = await marketplace2.buy(productIdBytes32, 100)
        const tr4 = await tx4.wait(0)
        assert.deepStrictEqual(tr4.events.map(e => e.event), ["NewSubscription", "Subscribed", undefined])  // 3rd event is token.Transfer
    })
})
