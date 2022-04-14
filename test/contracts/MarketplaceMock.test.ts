import { waffle } from "hardhat"
import { expect, use } from "chai"
import { BigNumber } from "ethers"

import MarketplaceDummyJson from "../../artifacts/contracts/MarketplaceMock.sol/MarketplaceMock.json"
import { IMarketplace } from "../../typechain/IMarketplace"

use(waffle.solidity)
const { deployContract, provider } = waffle

describe("MarketplaceMock", async () => {
    const [
        deployer,
        member0,
        joinPartAgent,
        ...others
    ] = provider.getWallets()

    it("works through the IMarketplace interface", async function () {
        const market = await deployContract(deployer, MarketplaceDummyJson) as IMarketplace
        const productId = "0x0000000000000000000000000000000000000000000000000000000000000001"
        await expect(market.buy(productId, "0")).to.emit(market, "Subscribed")
    })
})
