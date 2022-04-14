import { ethers } from "hardhat"

async function main() {
    const factory = await ethers.getContractFactory("MarketplaceMock")
    const contract = await factory.deploy()
    console.log(contract.address)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
