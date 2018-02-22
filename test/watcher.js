const testrpc = require("ethereumjs-testrpc")
const Web3 = require("web3")
const web3 = new Web3(testrpc.provider({
    mnemonic: "we make your streams come true",
    total_accounts: 10,
    gasLimit: 5000000
}))

const watcher = require("../src/watcher")

describe("Watcher", () => {
    let marketplace
    before(async () => {
        marketplace = await require("./deploy_marketplace")(web3)
    })

    it("starts successfully", () => {

    })
})
