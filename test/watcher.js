const web3 = require("./init_web3")()
const watcher = require("../src/watcher")

describe("Watcher", () => {
    let token, marketplace
    before(async () => {
        ({token, marketplace} = await require("./deploy_marketplace")(web3))
    })

    it("starts successfully", () => {

    })
})
